#include "File.h"

#include "Task.h"
#include "TaskTryCatch.h"

#include <cstring>
#include <fstream>
#include <iostream>
#include <uv.h>

#ifdef _WIN32
#include <windows.h>
#else
#include <dirent.h>
#include <unistd.h>
#endif

double timeSpecToDouble(uv_timespec_t& timeSpec);

struct FileStatData {
	Task* _task;
	promiseid_t _promise;
	uv_fs_t _request;
};

void File::configure(v8::Isolate* isolate, v8::Handle<v8::ObjectTemplate> global) {
	v8::Local<v8::ObjectTemplate> fileTemplate = v8::ObjectTemplate::New(isolate);
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "readFile"), v8::FunctionTemplate::New(isolate, readFile));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "readDirectory"), v8::FunctionTemplate::New(isolate, readDirectory));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "makeDirectory"), v8::FunctionTemplate::New(isolate, makeDirectory));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "writeFile"), v8::FunctionTemplate::New(isolate, writeFile));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "renameFile"), v8::FunctionTemplate::New(isolate, renameFile));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "unlinkFile"), v8::FunctionTemplate::New(isolate, unlinkFile));
	fileTemplate->Set(v8::String::NewFromUtf8(isolate, "stat"), v8::FunctionTemplate::New(isolate, stat));
	global->Set(v8::String::NewFromUtf8(isolate, "File"), fileTemplate);
}

void File::readFile(const v8::FunctionCallbackInfo<v8::Value>& args) {
	v8::HandleScope scope(args.GetIsolate());
	v8::Handle<v8::String> fileName = args[0]->ToString();

	v8::String::Utf8Value utf8FileName(fileName);
	std::ifstream file(*utf8FileName, std::ios_base::in | std::ios_base::binary | std::ios_base::ate);
	std::streampos fileSize = file.tellg();
	if (fileSize >= 0 && fileSize < 4 * 1024 * 1024) {
		file.seekg(0, std::ios_base::beg);
		v8::Handle<v8::ArrayBuffer> buffer = v8::ArrayBuffer::New(args.GetIsolate(), fileSize);
		file.read(reinterpret_cast<char*>(buffer->GetContents().Data()), fileSize);
		v8::Handle<v8::Uint8Array> array = v8::Uint8Array::New(buffer, 0, fileSize);
		args.GetReturnValue().Set(array);
	}
}

void File::writeFile(const v8::FunctionCallbackInfo<v8::Value>& args) {
	v8::HandleScope scope(args.GetIsolate());
	v8::Handle<v8::String> fileName = args[0]->ToString();
	v8::Handle<v8::Value> value = args[1];

	v8::String::Utf8Value utf8FileName(fileName);
	std::ofstream file(*utf8FileName, std::ios_base::out | std::ios_base::binary);

	if (value->IsArrayBufferView()) {
		v8::Handle<v8::ArrayBufferView> array = v8::Handle<v8::ArrayBufferView>::Cast(value);
		if (!file.write(reinterpret_cast<const char*>(array->Buffer()->GetContents().Data()), array->Buffer()->GetContents().ByteLength())) {
			args.GetReturnValue().Set(v8::Integer::New(args.GetIsolate(), -1));
		}
	} else if (value->IsString()) {
		v8::Handle<v8::String> stringValue = v8::Handle<v8::String>::Cast(value);
		if (stringValue->ContainsOnlyOneByte()) {
			std::vector<uint8_t> bytes(stringValue->Length());
			stringValue->WriteOneByte(bytes.data(), 0, bytes.size(), v8::String::NO_NULL_TERMINATION);
			if (!file.write(reinterpret_cast<const char*>(bytes.data()), bytes.size())) {
				args.GetReturnValue().Set(v8::Integer::New(args.GetIsolate(), -1));
			}
		} else {
			v8::String::Utf8Value utf8Contents(stringValue);
			if (!file.write(*utf8Contents, utf8Contents.length())) {
				args.GetReturnValue().Set(v8::Integer::New(args.GetIsolate(), -1));
			}
		}
	}
}

void File::renameFile(const v8::FunctionCallbackInfo<v8::Value>& args) {
	Task* task = reinterpret_cast<Task*>(args.GetIsolate()->GetData(0));
	v8::HandleScope scope(args.GetIsolate());

	v8::String::Utf8Value oldName(args[0]->ToString());
	v8::String::Utf8Value newName(args[1]->ToString());

	uv_fs_t req;
	int result = uv_fs_rename(task->getLoop(), &req, *oldName, *newName, 0);
	args.GetReturnValue().Set(v8::Integer::New(args.GetIsolate(), result));
}

void File::unlinkFile(const v8::FunctionCallbackInfo<v8::Value>& args) {
	Task* task = reinterpret_cast<Task*>(args.GetIsolate()->GetData(0));
	v8::HandleScope scope(args.GetIsolate());

	v8::String::Utf8Value fileName(args[0]->ToString());

	uv_fs_t req;
	int result = uv_fs_unlink(task->getLoop(), &req, *fileName, 0);
	args.GetReturnValue().Set(v8::Integer::New(args.GetIsolate(), result));
}

void File::readDirectory(const v8::FunctionCallbackInfo<v8::Value>& args) {
	v8::HandleScope scope(args.GetIsolate());
	v8::Handle<v8::String> directory = args[0]->ToString();

	v8::Handle<v8::Array> array = v8::Array::New(args.GetIsolate(), 0);

#ifdef _WIN32
	WIN32_FIND_DATA find;
	std::string pattern = *v8::String::Utf8Value(directory);
	pattern += "\\*";
	HANDLE handle = FindFirstFile(pattern.c_str(), &find);
	if (handle != INVALID_HANDLE_VALUE) {
		int index = 0;
		do {
			array->Set(v8::Integer::New(args.GetIsolate(), index++), v8::String::NewFromUtf8(args.GetIsolate(), find.cFileName));
		} while (FindNextFile(handle, &find) != 0);
		FindClose(handle);
	}
#else
	if (DIR* dir = opendir(*v8::String::Utf8Value(directory))) {
		int index = 0;
		while (struct dirent* entry = readdir(dir)) {
			array->Set(v8::Integer::New(args.GetIsolate(), index++), v8::String::NewFromUtf8(args.GetIsolate(), entry->d_name));
		}
		closedir(dir);
	}
#endif

	args.GetReturnValue().Set(array);
}

void File::makeDirectory(const v8::FunctionCallbackInfo<v8::Value>& args) {
	Task* task = Task::get(args.GetIsolate());
	v8::HandleScope scope(args.GetIsolate());
	v8::Handle<v8::String> directory = args[0]->ToString();

	uv_fs_t req;
	int result = uv_fs_mkdir(task->getLoop(), &req, *v8::String::Utf8Value(directory), 0755, 0);
	args.GetReturnValue().Set(result);
}

void File::stat(const v8::FunctionCallbackInfo<v8::Value>& args) {
	if (Task* task = Task::get(args.GetIsolate())) {
		v8::HandleScope scope(args.GetIsolate());
		v8::Handle<v8::String> path = args[0]->ToString();

		promiseid_t promise = task->allocatePromise();

		FileStatData* data = new FileStatData;
		data->_task = task;
		data->_promise = promise;
		data->_request.data = data;

		int result = uv_fs_stat(task->getLoop(), &data->_request, *v8::String::Utf8Value(path), onStatComplete);
		if (result) {
			task->resolvePromise(promise, v8::Number::New(args.GetIsolate(), result));
			delete data;
		}
		args.GetReturnValue().Set(task->getPromise(promise));
	}
}

double timeSpecToDouble(uv_timespec_t& timeSpec) {
	return timeSpec.tv_sec + static_cast<double>(timeSpec.tv_nsec) / 1e9;
}

void File::onStatComplete(uv_fs_t* request) {
	FileStatData* data = reinterpret_cast<FileStatData*>(request->data);
	v8::EscapableHandleScope scope(data->_task->getIsolate());
	TaskTryCatch tryCatch(data->_task);
	v8::Isolate* isolate = data->_task->getIsolate();
	v8::Context::Scope contextScope(v8::Local<v8::Context>::New(isolate, data->_task->getContext()));

	if (request->result) {
		data->_task->rejectPromise(data->_promise, v8::Number::New(data->_task->getIsolate(), request->result));
	} else {
		v8::Handle<v8::Object> result = v8::Object::New(isolate);
		result->Set(v8::String::NewFromUtf8(isolate, "mtime"), v8::Number::New(isolate, timeSpecToDouble(request->statbuf.st_mtim)));
		result->Set(v8::String::NewFromUtf8(isolate, "ctime"), v8::Number::New(isolate, timeSpecToDouble(request->statbuf.st_ctim)));
		result->Set(v8::String::NewFromUtf8(isolate, "atime"), v8::Number::New(isolate, timeSpecToDouble(request->statbuf.st_atim)));
		result->Set(v8::String::NewFromUtf8(isolate, "size"), v8::Number::New(isolate, request->statbuf.st_size));
		data->_task->resolvePromise(data->_promise, result);
	}
	delete data;
}
