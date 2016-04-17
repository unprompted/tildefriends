#include "Task.h"
#include "TaskStub.h"
#include "TaskTryCatch.h"

#include <cstring>
#include <libplatform/libplatform.h>
#include <uv.h>
#include <v8.h>
#include <v8-platform.h>

#if !defined (_WIN32) && !defined (__MACH__)
#include <signal.h>
#include <sys/prctl.h>
#include <sys/resource.h>
#include <unistd.h>
#endif

v8::Platform* gPlatform = 0;

void shedPrivileges() {
#if !defined (_WIN32)
	struct rlimit zeroLimit;
	zeroLimit.rlim_cur = 0;
	zeroLimit.rlim_max = 0;

	// RLIMIT_AS
	// RLIMIT_CORE
	// RLIMIT_CPU
	// RLIMIT_DATA
	// RLIMIT_FSIZE
	// RLIMIT_RSS
	// RLIMIT_RTPRIO
	// RLIMIT_RTTIME
	// RLIMIT_SIGPENDING
	// RLIMIT_STACK

	if (setrlimit(RLIMIT_FSIZE, &zeroLimit) != 0) {
		perror("setrlimit(RLIMIT_FSIZE, {0, 0})");
		exit(-1);
	}
	if (setrlimit(RLIMIT_NOFILE, &zeroLimit) != 0) {
		perror("setrlimit(RLIMIT_NOFILE, {0, 0})");
		exit(-1);
	}
	if (setrlimit(RLIMIT_NPROC, &zeroLimit) != 0) {
		perror("setrlimit(RLIMIT_NPROC, {0, 0})");
		exit(-1);
	}
#if !defined (__MACH__)
	if (setrlimit(RLIMIT_LOCKS, &zeroLimit) != 0) {
		perror("setrlimit(RLIMIT_LOCKS, {0, 0})");
		exit(-1);
	}
	if (setrlimit(RLIMIT_MSGQUEUE, &zeroLimit) != 0) {
		perror("setrlimit(RLIMIT_MSGQUEUE, {0, 0})");
		exit(-1);
	}
#endif
#endif
}

int main(int argc, char* argv[]) {
	int result = 0;
	uv_setup_args(argc, argv);
	TaskStub::initialize();
	v8::V8::InitializeICU();
	gPlatform = v8::platform::CreateDefaultPlatform();
	v8::V8::InitializePlatform(gPlatform);
	v8::V8::Initialize();
	v8::V8::SetFlagsFromCommandLine(&argc, argv, true);

	bool isChild = false;
	const char* coreTask = "core/core.js";

	for (int i = 1; i < argc; ++i) {
		if (!std::strcmp(argv[i], "--child")) {
			isChild = true;
		} else {
			coreTask = argv[i];
		}
	}

#if !defined (_WIN32)
	if (signal(SIGPIPE, SIG_IGN) == SIG_ERR) {
		perror("signal");
	}
#endif

	if (isChild) {
#if !defined (_WIN32) && !defined (__MACH__)
		prctl(PR_SET_PDEATHSIG, SIGHUP);
#endif
		Task task;
		task.configureFromStdin();
		shedPrivileges();
		task.activate();
		task.run();
	} else {
#if !defined (_WIN32) && !defined (__MACH__)
		setpgid(0, 0);
#endif
		Task task;
		task.setTrusted(true);
		task.activate();

		{
			v8::Isolate::Scope isolateScope(task.getIsolate());
			v8::HandleScope handleScope(task.getIsolate());
			v8::Context::Scope contextScope(task.getContext());
			TaskTryCatch tryCatch(&task);
			if (!task.execute(coreTask))
			{
				result = -1;
			}
			if (tryCatch.hasCaught())
			{
				result = -2;
			}
		}

		if (result == 0)
		{
			task.run();
		}
	}

	v8::V8::Dispose();

	return result;
}
