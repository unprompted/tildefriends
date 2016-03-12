#ifndef INCLUDED_Task
#define INCLUDED_Task

#include "PacketStream.h"

#include <cstring>
#include <iostream>
#include <list>
#include <map>
#include <string>
#include <v8.h>
#include <v8-platform.h>
#include <vector>

struct ExportRecord;
struct ImportRecord;
class Task;
class TaskStub;

struct uv_loop_s;
typedef struct uv_loop_s uv_loop_t;

typedef int taskid_t;
typedef int promiseid_t;
typedef int exportid_t;

enum MessageType {
	kResolvePromise,
	kRejectPromise,
	kInvokeExport,
	kReleaseExport,
	kReleaseImport,
	kSetTrusted,
	kActivate,
	kExecute,
	kKill,
	kStatistics,
	kSetImports,
	kGetExports,
};

class NewArrayBufferAllocator : public v8::ArrayBuffer::Allocator {
public:
	void* Allocate(size_t length) {
		char* bytes = new char[length];
		std::memset(bytes, 0, length);
		return bytes;
	}

	void* AllocateUninitialized(size_t length) {
		return new char[length];
	}

	void Free(void* data, size_t length) {
		delete[] reinterpret_cast<char*>(data);
	}
};

class Task {
public:
	Task();
	~Task();

	const std::string& getName() const { return _scriptName; }
	v8::Isolate* getIsolate() { return _isolate; }
	uv_loop_t* getLoop() { return _loop; }
	v8::Handle<v8::Context> getContext();
	void kill();

	promiseid_t allocatePromise();
	v8::Handle<v8::Promise::Resolver> getPromise(promiseid_t promise);
	void resolvePromise(promiseid_t promise, v8::Handle<v8::Value> value);
	void rejectPromise(promiseid_t promise, v8::Handle<v8::Value> value);

	void configureFromStdin();
	void setTrusted(bool trusted) { _trusted = trusted; }
	void execute(const char* fileName);
	void activate();
	void run();

	static int getCount() { return _count; }
	static Task* get(v8::Isolate* isolate);
	TaskStub* get(taskid_t taskId);

	exportid_t exportFunction(v8::Handle<v8::Function> function);
	static void invokeExport(const v8::FunctionCallbackInfo<v8::Value>& args);
	v8::Handle<v8::Function> addImport(taskid_t taskId, exportid_t exportId);
	void releaseExport(taskid_t taskId, exportid_t exportId);

private:
	static int _count;

	TaskStub* _stub = 0;
	TaskStub* _parent = 0;
	taskid_t _nextTask = 1;
	static const taskid_t kParentId = 0;
	std::map<taskid_t, TaskStub*> _children;

	typedef std::map<std::string, v8::Persistent<v8::Object, v8::CopyablePersistentTraits<v8::Object> > > ScriptExportMap;
	ScriptExportMap _scriptExports;

	bool _trusted = false;
	bool _killed = false;
	std::string _scriptName;
	NewArrayBufferAllocator _allocator;
	v8::Isolate* _isolate = 0;

	std::map<promiseid_t, v8::Persistent<v8::Promise::Resolver, v8::CopyablePersistentTraits<v8::Promise::Resolver> > > _promises;
	promiseid_t _nextPromise = 0;
	uv_loop_t* _loop = 0;

	std::map<exportid_t, ExportRecord*> _exports;
	exportid_t _nextExport = 0;

	v8::Persistent<v8::Context, v8::CopyablePersistentTraits<v8::Context> > _context;

	std::vector<ImportRecord*> _imports;

	v8::Persistent<v8::Object, v8::CopyablePersistentTraits<v8::Object> > _importObject;
	v8::Persistent<v8::Object, v8::CopyablePersistentTraits<v8::Object> > _exportObject;

	v8::Handle<v8::Object> getStatistics();

	std::string resolveRequire(const std::string& require);

	static void activate(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void exit(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void print(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void require(const v8::FunctionCallbackInfo<v8::Value>& args);

	static void setTimeout(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void timeoutCallback(uv_timer_t* handle);

	static void invokeThen(const v8::FunctionCallbackInfo<v8::Value>& args);
	static void invokeCatch(const v8::FunctionCallbackInfo<v8::Value>& args);

	static void parent(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);
	static void version(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);
	static void statistics(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);

	static void utf8Length(const v8::FunctionCallbackInfo<v8::Value>& args);

	static void getImportProperty(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);
	static void getImports(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);
	static void getExports(v8::Local<v8::String> property, const v8::PropertyCallbackInfo<v8::Value>& args);
	static void setExports(v8::Local<v8::String> property, v8::Local<v8::Value> value, const v8::PropertyCallbackInfo<void>& args);

	static v8::Handle<v8::Value> invokeExport(TaskStub* from, Task* to, exportid_t exportId, const std::vector<char>& buffer);
	static void sendPromiseResolve(Task* from, TaskStub* to, promiseid_t promise, v8::Handle<v8::Value> result);
	static void sendPromiseReject(Task* from, TaskStub* to, promiseid_t promise, v8::Handle<v8::Value> result);

	static void onReceivePacket(int packetType, const char* begin, size_t length, void* userData);

	static void sendPromiseMessage(Task* from, TaskStub* to, MessageType messageType, promiseid_t promise, v8::Handle<v8::Value> result);
	static void sendPromiseExportMessage(Task* from, TaskStub* to, MessageType messageType, promiseid_t promiseId, exportid_t exportId, v8::Handle<v8::Value> result);

	static v8::Handle<v8::String> loadFile(v8::Isolate* isolate, const char* fileName);

	friend struct ImportRecord;
	friend class TaskStub;
};

#endif
