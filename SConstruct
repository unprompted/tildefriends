#!/usr/bin/python

import os
import sys

options = Variables('options.cache', ARGUMENTS)
options.AddVariables(PathVariable('uv', 'Location of libuv', '../sys/libuv'))
options.AddVariables(PathVariable('v8', 'Location of v8', '../sys/v8'))
options.AddVariables(BoolVariable('package', 'Build a package', False))

VariantDir('build/src', 'src', duplicate=0)
VariantDir('build/deps', 'deps', duplicate=0)
kwargs = {}
if sys.platform == 'darwin':
	kwargs['CXX'] = 'clang++'

env = Environment(options=options, tools=['default', 'packaging'], **kwargs)
options.Save('options.cache', env)
Help(options.GenerateHelpText(env))

v8 = env['v8']
uv = env['uv']
env.Append(CPPPATH=[
	os.path.join(v8, 'include'),
	v8,
	os.path.join(uv, 'include'),
	os.path.join('deps', 'liblmdb'),
])
if sys.platform == 'win32':
	env.Append(LIBS=['v8_base_0', 'v8_base_1', 'v8_base_2', 'v8_base_3', 'v8_libbase', 'v8_libplatform', 'v8_nosnapshot', 'icui18n', 'icuuc', 'libuv', 'advapi32', 'winmm', 'wsock32', 'ws2_32', 'psapi', 'iphlpapi', 'userenv', 'user32'])
	env.Append(CXXFLAGS=['/EHsc', '/MT', '/Zi', '/Gy'])
	env.Append(CFLAGS=['/EHsc', '/MT', '/Zi', '/Gy'])
	env.Append(LIBPATH=[
		os.path.join(v8, 'build/Release/lib'),
		os.path.join(uv, 'Release/lib'),
	])
	env.Append(LINKFLAGS=['/RELEASE', '/OPT:REF', '/OPT:ICF'])
elif sys.platform == 'darwin':
	env.Append(LIBS=['v8_base', 'v8_libbase', 'v8_libsampler', 'v8_libplatform', 'v8_nosnapshot', 'icui18n', 'icuuc', 'pthread', 'uv'])
	env.Append(CXXFLAGS=['--std=c++11', '-g', '-Wall', '-stdlib=libc++'])
	env.Append(CFLAGS=['-g', '-Wall'])
	env.Append(LINKFLAGS=['-g', '-stdlib=libc++'])
	env.Append(LIBPATH=[
		os.path.join(v8, 'out/native'),
		os.path.join(uv, 'build/Release'),
	])
else:
	env.Append(LIBS=['v8_libplatform', 'v8_base', 'v8_libbase', 'v8_libsampler', 'v8_nosnapshot', 'icui18n', 'icuuc', 'pthread', 'uv', 'rt', 'dl'])
	env.Append(CXXFLAGS=['--std=c++0x', '-g', '-Wall'])
	env.Append(CFLAGS=['-g', '-Wall'])
	env.Append(LINKFLAGS=['-g'])
	env.Append(LIBPATH=[
		os.path.join(v8, 'out/native/obj.target/third_party/icu'),
		os.path.join(v8, 'out/native/obj.target/src'),
		os.path.join(uv, 'out/Debug/obj.target'),
	])

ldapEnv = env.Clone()
if sys.platform == 'win32':
	ldapEnv.Append(CPPPATH=['deps/win32'])
lmdb = ldapEnv.Library('build/lmdb', [
	'build/deps/liblmdb/mdb.c',
	'build/deps/liblmdb/midl.c',
])
env.Append(LIBS=[lmdb])

if sys.platform == 'linux2':
	env.Append(LIBS=['crypto', 'ssl'])

source = [s for s in Glob('build/src/*.cpp') if not os.path.basename(str(s)).startswith("SecureSocket_")]
if sys.platform == 'darwin':
	env.Append(FRAMEWORKS=['CoreFoundation', 'Security'])
elif sys.platform == 'win32':
	env.Append(LIBS=['Crypt32'])
env.Program('tildefriends', source)

def listAllFiles(root):
	for root, dirs, files in os.walk(root):
		for f in files:
			if not f.startswith('.'):
				yield os.path.join(root, f)
		hidden = [d for d in dirs if d.startswith('.')]
		for d in hidden:
			dirs.remove(d)

if env['package'] and sys.platform == 'win32':
	files = [
		'COPYING',
		'LICENSE',
		'SConstruct',
		'tildefriends.exe',
	]
	files += listAllFiles('src')
	files += listAllFiles('packages')
	files += listAllFiles('core')
	env.Package(
		NAME='TildeFriends',
		target='dist/TildeFriends-win32.zip',
		PACKAGETYPE='zip',
		PACKAGEROOT='TildeFriends-win32',
		source=files
	)
