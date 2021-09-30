#!/usr/bin/python3

# -*- coding: utf-8 -*-
#########################################################
# SERVICE : smartfancontrol-logger.py                   #
#           data-logging daemon for smartfoncontrol.    #
#                                                       #
#           I. Helwegen 2021                            #
#########################################################

####################### IMPORTS #########################
import sys
import os
import time
import psutil
import signal
import json
from database import database

#########################################################

####################### GLOBALS #########################
VERSION      = "0.80"
STDINTERVAL  = 60
MON_FILENAME = "/run/smartfancontrol"
LOG_FILENAME = "/var/log/smartfancontrol-data.log"

#########################################################

###################### FUNCTIONS ########################

#########################################################
# Class : Daemon                                        #
#########################################################

class daemon(object):
    """
    Usage: - create your own a subclass Daemon class and override the run() method. Run() will be periodically the calling inside the infinite run loop
           - you can receive reload signal from self.isReloadSignal and then you have to set back self.isReloadSignal = False
    """
    def __init__(self, processName = "", stdin='/dev/null', stdout='/dev/null', stderr='/dev/null'):
        self.pauseRunLoop = 0    # 0 means none pause between the calling of run() method.
        self.restartPause = 1    # 0 means without a pause between stop and start during the restart of the daemon
        self.waitToHardKill = 1  # when terminate a process, wait until kill the process with SIGTERM signal
        self.isReloadSignal = False
        self._canDaemonRun = True
        if not processName:
            self.processName = os.path.basename(sys.argv[0])
        else:
            self.processName = processName
        self.stdin = stdin
        self.stdout = stdout
        self.stderr = stderr

    def _sigterm_handler(self, signum, frame):
        self._canDaemonRun = False

    def _reload_handler(self, signum, frame):
        self.isReloadSignal = True

    def _makeDaemon(self):
        """
        Make a daemon, do double-fork magic.
        """
        try:
            pid = os.fork()
            if pid > 0:
                # Exit first parent.
                sys.exit(0)
        except OSError as e:
            sys.stderr.write("Fork #1 failed: {}".format(e))
            sys.exit(1)
        # Decouple from the parent environment.
        os.chdir("/")
        os.setsid()
        os.umask(0)
        # Do second fork.
        try:
            pid = os.fork()
            if pid > 0:
                # Exit from second parent.
                sys.exit(0)
        except OSError as e:
            sys.stderr.write("Fork #2 failed: {}".format(e))
            sys.exit(1)
        #print("The daemon process is going to background.")
        # Redirect standard file descriptors.
        sys.stdout.flush()
        sys.stderr.flush()
        si = open(self.stdin, 'r')
        so = open(self.stdout, 'a+')
        se = open(self.stderr, 'a+')
        os.dup2(si.fileno(), sys.stdin.fileno())
        os.dup2(so.fileno(), sys.stdout.fileno())
        os.dup2(se.fileno(), sys.stderr.fileno())

    def _getProces(self):
        procs = []
        for p in psutil.process_iter():
            if self.processName in [part.split('/')[-1] for part in p.cmdline()]:
                # Skip  the current process
                if p.pid != os.getpid():
                    procs.append(p)
        return procs

    def start(self):
        """
        Start daemon.
        """
        # Handle signals
        signal.signal(signal.SIGINT, self._sigterm_handler)
        signal.signal(signal.SIGTERM, self._sigterm_handler)
        signal.signal(signal.SIGHUP, self._reload_handler)
        # Check if the daemon is already running.
        procs = self._getProces()
        if procs:
            pids = ",".join([str(p.pid) for p in procs])
            print("{} already running with PID {}".format(self.processName, pids))
            sys.exit(1)
        else:
            print("{} started".format(self.processName))
        # Daemonize the main process
        self._makeDaemon()
        # Start a infinitive loop that periodically runs run() method
        self.init()
        self._infiniteLoop()

    def status(self):
        """
        Get status of the daemon.
        """
        procs = self._getProces()
        if procs:
            pids = ",".join([str(p.pid) for p in procs])
            print("{} is running with PID {}".format(self.processName, pids))
            exit(0)
        else:
            print("{} is not running".format(self.processName))
            exit(1)

    def reload(self):
        """
        Reload the daemon.
        """
        procs = self._getProces()
        if procs:
            for p in procs:
                os.kill(p.pid, signal.SIGHUP)
                print("{} send SIGHUP signal for PID {}".format(self.processName, p.pid))
        else:
            print("{} is not running".format(self.processName))

    def stop(self):
        """
        Stop the daemon.
        """
        procs = self._getProces()
        def on_terminate(process):
            print("{} with PID {} terminated".format(self.processName, process.pid))
            self.exit()
        if procs:
            for p in procs:
                p.terminate()
            gone, alive = psutil.wait_procs(procs, timeout=self.waitToHardKill, callback=on_terminate)
            for p in alive:
                print("{} with PID {} killed".format(self.processName, p.pid))
                p.kill()
        else:
            print("{} is not running".format(self.processName))

    def restart(self):
        """
        Restart the daemon.
        """
        self.stop()
        if self.restartPause:
            time.sleep(self.restartPause)
        self.start()

    def _infiniteLoop(self):
        try:
            if self.pauseRunLoop:
                time.sleep(self.pauseRunLoop)
                while self._canDaemonRun:
                    self.run()
                    time.sleep(self.pauseRunLoop)
            else:
                while self._canDaemonRun:
                    self.run()
        except Exception as e:
            sys.stderr.write("Run method failed: {}".format(e))
            sys.exit(1)

    def init(self):
        pass

    def exit(self):
        pass

    # this method you have to override
    def run(self):
        pass

#########################################################
# Class : sfclogger                                     #
#########################################################

# an example of a custom run method where you can set your useful python code
class sfclogger(daemon):
    def __init__(self, processName = ""):
        self.interval = STDINTERVAL
        super(sfclogger, self).__init__()

    def __del__(self):
        pass

    def setInterval(self, interval = STDINTERVAL):
        self.interval = interval

    def init(self):
        try:
            with open(LOG_FILENAME, 'w'):
                pass
        except:
            pass

    def run(self):
        try:
            with open(MON_FILENAME, 'r') as mon_file:
                content = mon_file.read()
        except:
            content = "0, 0, 0, Nok\n"
        current_time = int(time.time())
        try:
            if content:
                with open(LOG_FILENAME, 'a') as log_file:
                    log_file.write("{}, {}".format(current_time, content))
        except:
            pass
        time.sleep(self.interval)

#########################################################
# Class : sfclgr                                        #
#########################################################

class sfclgr(object):
    def __init__(self):
        self.name = ""

    def __del__(self):
        pass

    def __str__(self):
        return "{}: logger for smartfancontrol".format(self.name)

    def __repr__(self):
        return self.__str__()

    def run(self, argv):
        if len(os.path.split(argv[0])) > 1:
            self.name = os.path.split(argv[0])[1]
        else:
            self.name = argv[0]
        logger = sfclogger(self.name)

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
        if len(sys.argv) >= 2:
            choice = sys.argv[1]
            if choice == "start":
                if len(sys.argv) > 2:
                    interval = int(sys.argv[2])
                    if interval <= 0:
                        interval = STDINTERVAL
                    logger.setInterval(interval)
                logger.start()
            elif choice == "stop":
                logger.stop()
            elif choice == "status":
                logger.status()
            elif choice == "list":
                self.lst()
            else:
                self.parseError(argv[1])
                sys.exit(1)
            sys.exit(0)
        else:
            self.jlst()
            sys.exit(0)

    def printHelp(self):
        print(self)
        print("Usage:")
        print("    {} {}".format(self.name, "<argument>"))
        print("    <arguments>")
        print("        start         : start logging <interval in seconds = 60>")
        print("        stop          : stop logging")
        print("        status        : logger status (0=running, 1=not running)")
        print("        list          : prints logfile in CSV format")
        print("        <no arguments>: prints logfile in JSON format")
        print("")

    def parseError(self, opt = ""):
        print(self)
        print("Invalid option entered")
        if opt:
            print(opt)
        print("Enter '{} -h' for help".format(self.name))
        exit(1)

    def lst(self):
        try:
            db = database()
            farenheit = db()["temp"]["Farenheit"]
            mode = db()["fan"]["mode"]
            del db
            print("Mode: {}".format(mode))
            print("Farenheit: {}".format(farenheit))
        except:
            pass
        try:
            print("time, temp, rpm, pwm, alarm")
            with open(LOG_FILENAME, 'r') as log_file:
                while True:
                    line = log_file.readline()
                    if not line:
                        break
                    print(line.strip())
        except:
            pass

    def jlst(self):
        data = {}
        settings = {}
        try:
            db = database()
            settings["farenheit"] = db()["temp"]["Farenheit"]
            settings["mode"] = db()["fan"]["mode"]
            del db
        except:
            pass
        data["settings"] = settings
        vals = []
        try:
            with open(LOG_FILENAME, 'r') as log_file:
                while True:
                    line = log_file.readline()
                    if not line:
                        break
                    val = {}
                    content = line.split(",")
                    try:
                        val['time'] = content[0].strip()
                        val['temp'] = content[1].strip()
                        val['rpm'] = content[2].strip()
                        val['pwm'] = content[3].strip()
                        val['alarm'] = content[4].strip()
                        vals.append(val)
                    except:
                        pass
        except:
            pass
        data["data"] = vals
        print(json.dumps(data))

######################### MAIN ##########################
if __name__ == "__main__":
    sfclgr().run(sys.argv)
