# SImply wraps commands such as
# chronos.exe -setup ./chronos/chronos-msl.setup -from utc -fromtype scet -to lst -totype lst -time "2023-07-27 23:16:05.644" -NOLABEL
# chronos.exe -setup ./chronos/chronos-msl.setup -to utc -totype scet -from lst -fromtype lst -time "SOL 3901 03:46:54" -NOLABEL

# Run like:
# python chronos.py {target} {from} {fromtype} {to} {totype} {time}
# python chronos.py msl utc scet lst lst "2023-07-27 23:16:05.644"
# returns: {"result": "SOL 3901 03:46:54"}
# if errors, returns: {"error": true, "message": "error_message"}

import sys
import json
import os
import subprocess
import shlex
import platform 


try:
    from urllib.parse import unquote
except ImportError:
    from urllib import unquote

def chronos(target, fromFormat, fromtype, to, totype, time):
    package_dir = os.path.dirname(os.path.abspath(__file__)).replace('\\','/')

    plt = platform.system()

    if plt == "Windows":
        cmd = os.path.join(package_dir + '/', 'chronos.exe')
    else:
        cmd = os.path.join(package_dir + '/', 'chronos')
        
    target = target.replace('\\','').replace('/','')
    setup = os.path.join(package_dir + '/', f'chronosSetups/chronos-{target}.setup')
    fullCmd = shlex.split(f'{cmd} -setup {setup} -from {fromFormat} -fromtype {fromtype} -to {to} -totype {totype} -time {time} -NOLABEL')

    result = subprocess.run(fullCmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)

    if result.returncode == 0:
        return json.dumps({
            "result": result.stdout.rstrip()
        })
    return json.dumps({
        "error": True,
        "message": result.stdout.rstrip()
    })

# Start
target = unquote(sys.argv[1])
fromFormat = unquote(sys.argv[2])
fromtype = unquote(sys.argv[3])
to = unquote(sys.argv[4])
totype = unquote(sys.argv[5])
time = unquote(sys.argv[6])

try:
    print(chronos(target, fromFormat, fromtype, to, totype, time))
except:
    print(json.dumps({"error": True, "message": 'Error: ' + str(sys.exc_info()[0])}))