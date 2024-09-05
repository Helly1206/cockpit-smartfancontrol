#!/usr/bin/python3

# -*- coding: utf-8 -*-
#########################################################
# SERVICE : smartfancontrol-cli.py                      #
#           Commandline interface for automating        #
#           smartfancontrol for commandline or app.     #
#           I. Helwegen 2020                            #
#########################################################

####################### IMPORTS #########################
import sys
import os
import json
import subprocess
from database import database

#########################################################

####################### GLOBALS #########################
VERSION      = "0.86"
DAEMONSFC    = "smartfancontrol"
CMDNOTEXIST  = 127
CMDTIMEOUT   = 124
SYSTEMCTL    = "systemctl"
CTLSTART     = SYSTEMCTL + " start"
CTLSTOP      = SYSTEMCTL + " stop"
CTLRELOAD    = SYSTEMCTL + " reload"
CTLRESTART   = SYSTEMCTL + " restart"
CTLENABLE    = SYSTEMCTL + " enable"
CTLDISABLE   = SYSTEMCTL + " disable"
CTLSTATUS    = SYSTEMCTL + " status"
CTLISACTIVE  = SYSTEMCTL + " is-active"
CTLISENABLED = SYSTEMCTL + " is-enabled"
MON_FILENAME = "/run/smartfancontrol"
#########################################################

###################### FUNCTIONS ########################

#########################################################
# Class : shell                                         #
#########################################################
class shell(object):
    def __init__(self):
        pass

    def __del__(self):
        pass

    def runCommand(self, cmd, input = None, timeout = None):
        CMDNOTEXIST = 127, "", ""
        if input:
            input = input.encode("utf-8")
        try:
            if timeout == 0:
                timout = None
            out = subprocess.run(cmd, shell=True, capture_output=True, input = input, timeout = timeout)
            retval = out.returncode, out.stdout.decode("utf-8"), out.stderr.decode("utf-8")
        except subprocess.TimeoutExpired:
            retval = CMDTIMEOUT, "", ""

        return retval

    def command(self, cmd, retcode = 0, input = None, timeout = None, timeoutError = False):
        returncode, stdout, stderr = self.runCommand(cmd, input, timeout)

        if returncode == CMDTIMEOUT and not timeoutError:
            returncode = 0
        if retcode != returncode:
            self.handleError(returncode, stderr)

        return stdout

    def commandExists(self, cmd):
        returncode, stdout, stderr = self.runCommand(cmd)

        return returncode != CMDNOTEXIST

    def handleError(self, returncode, stderr):
        exc = ("External command failed.\n"
               "Command returned: {}\n"
               "Error message:\n{}").format(returncode, stderr)
        raise Exception(exc)

#########################################################
# Class : systemdctl                                    #
#########################################################
class systemdctl(object):
    def __init__(self):
        self.hasSystemd = False
        try:
            self.hasSystemd = self.checkInstalled()
        except Exception as e:
            print("Error reading systemd information")
            print(e)
            exit(1)

    def __del__(self):
        pass

    def available(self):
        return self.hasSystemd

    def start(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLSTART, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def stop(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLSTOP, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def reload(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLRELOAD, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def restart(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLRESTART, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def enable(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLENABLE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def disable(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLDISABLE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def status(self, service):
        retval = []
        if self.available():
            cmd = "{} {}".format(CTLSTATUS, service)
            try:
                retcode, stdout, stderr = shell().runCommand(cmd)
                retval = stdout.splitlines()
            except:
                pass
        return retval

    def isActive(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLISACTIVE, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

    def isEnabled(self, service):
        retval = False
        if self.available():
            cmd = "{} {}".format(CTLISENABLED, service)
            try:
                shell().command(cmd)
                retval = True
            except:
                pass
        return retval

################## INTERNAL FUNCTIONS ###################

    def checkInstalled(self):
        return shell().commandExists(SYSTEMCTL)

#########################################################
# Class : sfccli                                        #
#########################################################
class sfccli(object):
    def __init__(self):
        self.name = ""

    def __del__(self):
        pass

    def __str__(self):
        return "{}: commandline interface for smartfancontrol".format(self.name)

    def __repr__(self):
        return self.__str__()

    def run(self, argv):
        if len(os.path.split(argv[0])) > 1:
            self.name = os.path.split(argv[0])[1]
        else:
            self.name = argv[0]

        for arg in argv:
            if arg[0] == "-":
                if arg == "-h" or arg == "--help":
                    self.printHelp()
                    exit()
                elif arg == "-v" or arg == "--version":
                    print(self)
                    print("Version: {}".format(VERSION))
                    exit()
                else:
                    self.parseError(arg)
        if len(argv) < 2:
            self.lst()
        elif argv[1] == "set":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <json options>"
                self.parseError(opt)
            self.set(argv[2])
        elif argv[1] == "get":
            opt = argv[1]
            self.get()
        elif argv[1] == "ctl":
            opt = argv[1]
            if len(argv) < 3:
                opt += " <name>"
                self.parseError(opt)
            self.ctl(argv[2])
        else:
            self.parseError(argv[1])

    def printHelp(self):
        print(self)
        print("Usage:")
        print("    {} {}".format(self.name, "<argument> <json options>"))
        print("    <arguments>")
        print("        set           : sets settings with <json options>")
        print("        get           : get all settings")
        print("        ctl           : controls daemon (start, stop, enable, disable, restart,")
        print("                                         reload, isactive, isenabled)")
        print("        <no arguments>: lists current values")
        print("")
        print("JSON options may be entered as single JSON string using full name, e.g.")
        print("{}".format(self.name), end="")
        print(" set \"{'fan': {'mode': 'RPM'}\"")
        print("Mind the double quotes to bind the JSON string.")

    def parseError(self, opt = ""):
        print(self)
        print("Invalid option entered")
        if opt:
            print(opt)
        print("Enter '{} -h' for help".format(self.name))
        exit(1)

    def lst(self):
        # current values from /run/smartfancontrol temp, fan RPM, fan PWM, alarm
        vals = {}
        vals['temp'] = -1
        vals['farenheit'] = False
        vals['rpm'] = -1
        vals['pwm'] = -1
        vals['alarm'] = "Ok"
        try:
            with open(MON_FILENAME, 'r') as mon_file:
                content = mon_file.read().split(',')
                temp = content[0].strip()
                if len(temp) > 0 and temp[0] == "0":
                    vals['temp'] = temp[1:]
                    vals['farenheit'] = True
                else:
                    vals['temp'] = temp
                    vals['farenheit'] = False
                vals['rpm'] = content[1].strip()
                vals['pwm'] = content[2].strip()
                vals['alarm'] = content[3].strip()
        except:
            pass
        print(json.dumps(vals))

    def set(self, opt):
        opts = {}
        db = database()
        try:
            opts = json.loads(opt)
        except:
            self.parseError("Invalid JSON format")
        try:
            for group, groupvalue in opts.items():
                if group in db():
                    for key, value in groupvalue.items():
                        if key in db()[group]:
                            if type(db()[group][key]) == bool:
                                db()[group][key] = db.bl(value)
                            else: # don't do further type checking to prevent int-float mismatches
                                db()[group][key] = value
            db.update()
            self.ctl("restart")
        except:
            self.parseError("Invalid settings format")

    def get(self):
        db = database()
        print(json.dumps(db()))

    def ctl(self, opt):
        result = {}
        sctl = systemdctl()
        if not sctl.available():
            print("Reason: systemd unavailable on your distro")
            print("{} cannot automatically restart the {} service".format(self.name, DAEMONSFC))
            print("You can try it yourself using a command like 'service {} restart'".format(DAEMONSFC))
            self.parseError()
        if opt == "start":
            result['result'] = sctl.start(DAEMONSFC)
        elif opt == "stop":
            result['result'] = sctl.stop(DAEMONSFC)
        elif opt == "restart":
            result['result'] = sctl.restart(DAEMONSFC)
        elif opt == "reload":
            result['result'] = sctl.reload(DAEMONSFC)
        elif opt == "enable":
            result['result'] = sctl.enable(DAEMONSFC)
        elif opt == "disable":
            result['result'] = sctl.disable(DAEMONSFC)
        elif opt == "isactive":
            result['result'] = sctl.isActive(DAEMONSFC)
        elif opt == "isenabled":
            result['result'] = sctl.isEnabled(DAEMONSFC)
        else:
            self.parseError("Invalid ctl option: {}".format(opt))
        print(json.dumps(result))

######################### MAIN ##########################
if __name__ == "__main__":
    sfccli().run(sys.argv)
