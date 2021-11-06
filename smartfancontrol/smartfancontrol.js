/*********************************************************
 * SCRIPT : smartfancontrol.js                           *
 *          Javascript for smartfancontrol Cockpit       *
 *          web-gui                                      *
 *          I. Helwegen 2020                             *
 *********************************************************/

////////////////////
// Common classes //
////////////////////

class sfcMonitor {
    constructor(el) {
        this.el = el;
        this.name = "monitor";
        this.startButton = null;
        this.stopButton = null;
        this.pane = new tabPane(this, el, this.name);
        this.refresh = 1000;
    }

    displayContent(el) {
        this.displayMonitor();
    }

    displayMonitor(text = "") {
        this.pane.dispose();
        this.pane.build(text, true);
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.displayButtons(true);
        this.setTimer();
        this.getSettings();
    }

    //TBD
    displayGraph(text = "") {
        this.pane.dispose();
        this.pane.build(text, false, true);
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1) + " - Graph";
        this.displayButtons(false);
        this.getData();
    }

    getSettings(callback) {
        var cb = function(data) {
            var iData = JSON.parse(data);
            this.buildEditForm(iData);
        }
        this.update = [];
        runCmd.call(this, cb);
    }

    displayButtons(grp = true) {
        var cb = function(data, status) {
            var running = (status == 0);
            if (grp) {
                this.pane.addButton("graph", "Log graph", this.displayGraph, true, false, false);
            } else {
                this.pane.addButton("monitor", "Monitor", this.displayMonitor, true, false, false);
                this.pane.addButton("refresh", "Refresh", this.displayGraph, false, false, false);
            }
            this.startButton = this.pane.addButton("start", "Start logging", this.startLogging, false, running, false);
            this.stopButton = this.pane.addButton("stop", "Stop logging", this.stopLogging, false, !running, false);
        }
        this.update = [];
        runLog.call(this, cb, "status");
    }

    refreshSettings(callback) {
        var cb = function(data) {
            var iData = JSON.parse(data);
            var form = this.pane.getSettingsEditForm();
            this.pane.getSettingsEditForm().updateData([{
                param: "temp",
                value: iData.temp
            }, {
                param: "rpm",
                value: iData.rpm
            }, {
                param: "pwm",
                value: iData.pwm
            }, {
                param: "alarm",
                value: iData.alarm
            }]);
        }
        this.update = [];
        runCmd.call(this, cb);
    }

    setTimer() {
        var onTimer = function() {
            this.refreshSettings();
        };
        if (this.timer == null) {
            this.timer = setInterval(onTimer.bind(this), this.refresh);
        }
    }

    clearTimer() {
        if (this.timer != null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    buildEditForm(aData) {
        var tempUnit = "&#176;C";
        if (aData.farenheit) {
            tempUnit = "&#176;F";
        }
        //{"temp": -1, "fan": -1, "alarm": "Ok"}
        var dlgData = [{
                param: "temp",
                text: "Temperature [" + tempUnit + "]",
                value: aData.temp,
                type: "number",
                disabled: false,
                readonly: true,
                comment: "Current system temperature in " + tempUnit + "."
            }, {
                param: "rpm",
                text: "Fan speed [RPM]",
                value: aData.rpm,
                type: "number",
                disabled: false,
                readonly: true,
                comment: "Current fan speed in RPM."
            }, {
                param: "pwm",
                text: "Fan control [PWM]",
                value: aData.pwm,
                type: "number",
                disabled: false,
                readonly: true,
                comment: "Current fan control in PWM."
            }, {
                param: "alarm",
                text: "Alarm",
                value: aData.alarm,
                type: "text",
                disabled: false,
                readonly: true,
                comment: "Current alarm status."
            }
        ];
        this.pane.getSettingsEditForm().setData(dlgData);
    }

    startLogging() {
        var cb = function(data, status) {
            if (status == 0) {
                if ((this.startButton) && (this.stopButton)) {
                    this.pane.setButtonDisabled(this.startButton, true);
                    this.pane.setButtonDisabled(this.stopButton, false);
                }
            }
        }
        this.update = [];
        runLog.call(this, cb, "start");
    }

    stopLogging() {
        var cb = function(data, status) {
            if (status == 0) {
                if ((this.startButton) && (this.stopButton)) {
                    this.pane.setButtonDisabled(this.startButton, false);
                    this.pane.setButtonDisabled(this.stopButton, true);
                }
            }
        }
        this.update = [];
        runLog.call(this, cb, "stop");
    }

    getData() {
        var cb = function(data, status) {
            if (status == 0) {
                var iData = JSON.parse(data);
                this.buildGraph(iData);
            }
        }
        this.update = [];
        runLog.call(this, cb);
    }

    buildGraph(iData) {
        var tempText = "";
        var ctrlText = "";
        var lData = this.processData(iData);
        if ('settings' in iData) {
            if ('farenheit' in iData.settings) {
                if (iData.settings.farenheit) {
                    tempText = "Temperature [°F]";
                } else {
                    tempText = "Temperature [°C]";
                }
            }
            if ('mode' in iData.settings) {
                if (iData.settings.mode == "RPM") {
                    ctrlText = "Fan speed [RPM]";
                } else if (iData.settings.mode == "PWM") {
                    ctrlText = "Fan control [PWM]";
                } else {
                    ctrlText = "Fan control [ONOFF]";
                }
            }
        }
        const data = {
            labels: lData.time,
            datasets: [{
                label: tempText,
                yAxisID: 'temp',
                backgroundColor: 'rgb(255, 99, 132)',
                borderColor: 'rgb(255, 99, 132)',
                data: lData.temp
            }, {
                label: ctrlText,
                yAxisID: 'ctrl',
                backgroundColor: 'rgb(70,130,180)',
                borderColor: 'rgb(70,130,180)',
                data: lData.ctrl
            }]
        };
        // TBD !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //can we zoom, tickdistance, x axis linear?
        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                scales: {
                    x: {
                        type: 'linear',
                            min: lData.scale.min,
                            max: lData.scale.max,
                            ticks: {
                                stepSize: lData.scale.step
                            },
                        title: {
                            display: true,
                            text: 'time [min]'
                        }
                    },
                    temp: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: tempText
                        }
                    },
                    ctrl: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: ctrlText
                        },
                        grid: {
                            drawOnChartArea: false, // only want the grid lines for one axis to show up
                        }
                    }
                }
            }
        };
        this.pane.getCanvas().setData();
        var myChart = new Chart(this.pane.getCanvas().getCanvas(), config);
    }

    processData(iData) {
        var tmStart = 0;
        var tmMax = 0;
        var lData = {};
        var timeScale = {};
        var timeData = [];
        var tempData = [];
        var ctrlData = [];
        var first = true;
        var modeRPM = false;

        if ('settings' in iData) {
            if ('mode' in iData.settings) {
                if (iData.settings.mode == "RPM") {
                    modeRPM = true;
                }
            }
        }

        if ('data' in iData) {
            iData.data.forEach(datum => {
                if ('time' in datum) {
                    let tmCur = parseInt(datum.time);
                    if (first) {
                        tmStart = tmCur;
                        tmMax = 0;
                        timeData.push(0);
                        first = false;
                    } else {
                        let tmVal = Math.trunc((tmCur-tmStart)/60);
                        if (tmVal > tmMax) {
                            tmMax = tmVal;
                        }
                        timeData.push(tmVal);
                    }
                }
                if ('temp' in datum) {
                    tempData.push(parseFloat(datum.temp));
                }
                if (modeRPM) {
                    if ('rpm' in datum) {
                        ctrlData.push(parseFloat(datum.rpm));
                    }
                } else {
                    if ('pwm' in datum) {
                        ctrlData.push(parseFloat(datum.pwm));
                    }
                }
            });
        }
        timeScale.min = 0;
        timeScale.max = tmMax;
        timeScale.step = 1;
        if (timeScale.max-timeScale.min > 10) {
            timeScale.step = Math.round((timeScale.max-timeScale.min)/10);
        }
        lData.scale = timeScale;
        lData.time = timeData;
        lData.temp = tempData;
        lData.ctrl = ctrlData;

        return lData;
    }
}

class sfcFan {
    constructor(el) {
        this.el = el;
        this.name = "fan settings";
        this.pane = new tabPane(this, el, this.name);
        this.update = [];
        this.btnUpdate = null;
    }

    displayContent(el) {
        this.displaySettings();
        this.getSettings();
    }

    displaySettings(text = "") {
        this.pane.dispose();
        this.pane.build(text, true);
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.btnUpdate = this.pane.addButton("Update", "Update", this.btnUpdateCallback, true, (Object.keys(this.update).length == 0), false);
    }

    getSettings(callback) {
        var cb = function(data) {
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
            var iData = JSON.parse(data);
            this.buildEditForm(iData.fan);
        }
        this.update = [];
        runCmd.call(this, cb, ['get']);
    }

    buildEditForm(aData) {
        var settingsCallback = function(param, value) {
            this.update = buildOpts(this.pane.getSettingsEditForm().getData(), aData);
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
        }
        //{"mode": "RPM", "ONOFFgpio": 27, "ONOFFinvert": false, "PWMcalibrated": 5,
        //"PWMgpio": 18, "RPMpullup": true, "PWMfrequency": 10000, "PWMinvert": false,
        //"recalibrate": 7, "RPMgpio": 17, "RPMppr": 2, "RPMedge": true, "RPMfiltersize": 0,
        //"Frequency": 10, "Pgain": 0.1, "Igain": 0.2}
        var dlgData = [{
                param: "mode",
                text: "Mode",
                value: aData.mode,
                type: "select",
                opts: ["ONOFF", "PWM", "RPM"],
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Is the mode used to control the fan. Default is RPM.<br>" +
    				     "ONOFF: Only on/ off control is used.<br>" +
    				     "PWM: PWM control is used, with no RPM feedback. " +
                         "Manual calibration is required.<br>" +
    				     "RPM: PWM control with RPM feedback is used. " +
                         "Calibration is performed automatically."
            }, {
                param: "ONOFFgpio",
                text: "ONOFF gpio",
                value: aData.ONOFFgpio,
                type: "number",
                min: 0,
                max: 27,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The GPIO pin for ONOFF control. Defaults to GPIO 27. " +
                         "This pin is used to switch on or off the fan in " +
                         "PWM and RPM mode if connected in one of these modes."
            }, {
                param: "ONOFFinvert",
                text: "ONOFF invert",
                value: aData.ONOFFinvert,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Invert the ONOFF signal required for some switching hardware. Default is false."
            }, {
                param: "PWMcalibrated",
                text: "PWM calibrated [%]",
                value: aData.PWMcalibrated,
                type: "number",
                min: 0,
                max: 100,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Is the calibrated PWM percentage where the fan starts running. Default is 30."
            }, {
                param: "PWMgpio",
                text: "PWM gpio",
                value: aData.PWMgpio,
                type: "number",
                min: 0,
                max: 27,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The GPIO pin for PWM control. Defaults to GPIO 18. Take care a hardware PWM " +
    					 "compatible pin is chosen."
            }, {
                param: "PWMfrequency",
                text: "PWM frequency [Hz]",
                value: aData.PWMfrequency,
                type: "number",
                min: 0,
                max: 30000,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The hardware PWM frequency in Hz. Default is 10000."
            }, {
                param: "PWMinvert",
                text: "PWM invert",
                value: aData.PWMinvert,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Invert the PWM signal required for some switching hardware. Default is false."
            }, {
                param: "recalibrate",
                text: "Recalibrate",
                value: aData.recalibrate,
                type: "number",
                min: 0,
                max: 365,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The number of days between automatic calibrations. Default is 7. " +
                         "Calibration is done at 12:00 PM. Only used in RPM mode."
            }, {
                param: "RPMgpio",
                text: "RPM gpio",
                value: aData.RPMgpio,
                type: "number",
                min: 0,
                max: 27,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The GPIO pin for RPM readout. Defaults to GPIO 17. Only used in RPM mode."
            }, {
                param: "RPMpullup",
                text: "RPM pullup",
                value: aData.RPMpullup,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Use internal pullup for RPM GPIO pin. Default is true. Only used in RPM mode."
            }, {
                param: "RPMppr",
                text: "RPM ppr",
                value: aData.RPMppr,
                type: "number",
                min: 0,
                max: 4096,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The number of RPM tacho pulses per revolution. Default is 2. Only used in RPM mode."
            }, {
                param: "RPMedge",
                text: "RPM edge",
                value: aData.RPMedge,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "If true, both positive and negative edges are used for RPM measurement. " +
                         "Default is true. Only used in RPM mode."
            }, {
                param: "RPMfiltersize",
                text: "RPM filter size",
                value: aData.RPMfiltersize,
                type: "number",
                min: 0,
                max: 255,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "If larger than 1, measured RPMs are filtered by an n-sized " +
                         "moving average filter Default is 0. Only used in RPM mode."
            }, {
                param: "Frequency",
                text: "Frequency [Hz]",
                value: aData.Frequency,
                type: "number",
                min: 0,
                max: 100,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The frequency of the fan control loop in Hz. default is 10."
            }, {
                param: "Pgain",
                text: "P gain",
                value: aData.Pgain,
                type: "number",
                min: 0,
                max: 10000,
                step: 0.001,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The P gain of the fan control loop. Default is 0.1. Only used in RPM mode."
            }, {
                param: "Igain",
                text: "I gain",
                value: aData.Igain,
                type: "number",
                min: 0,
                max: 10000,
                step: 0.001,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The I gain of the fan control loop. Default is 0.2. Only used in RPM mode."
            }
        ];
        this.pane.getSettingsEditForm().setData(dlgData);
    }

    btnUpdateCallback() {
        var cbYes = function() {
            var settings = {};
            settings.fan = this.update;
            this.pane.dispose();
            this.displaySettings("Updating settings...");
            runCmd.call(this, this.getSettings, ['set'], settings);
        };
        if (Object.keys(this.update).length > 0) {
            var txt = "Are you sure to update settings and restart smartfancontrol services?"
            new confirmDialog(this, "Update settings", txt, cbYes);
        } else {
            new msgBox(this, "No settings changed", "No update required!");
        }
    }
}

class sfcTemp {
    constructor(el) {
        this.el = el;
        this.name = "temperature settings";
        this.pane = new tabPane(this, el, this.name);
        this.update = [];
        this.btnUpdate = null;
    }

    displayContent(el) {
        this.displaySettings();
        this.getSettings();
    }

    displaySettings(text = "") {
        this.pane.dispose();
        this.pane.build(text, true);
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.btnUpdate = this.pane.addButton("Update", "Update", this.btnUpdateCallback, true, (Object.keys(this.update).length == 0), false);
    }

    getSettings(callback) {
        var cb = function(data) {
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
            var iData = JSON.parse(data);
            this.buildEditForm(iData.temp);
        }
        this.update = [];
        runCmd.call(this, cb, ['get']);
    }

    buildEditForm(aData) {
        var tempUnit = "&#176;C";
        var farenheit = aData.Farenheit;
        if (farenheit) {
            tempUnit = "&#176;F";
        }
        var settingsCallback = function(param, value) {
            var rData = this.pane.getSettingsEditForm().getData();
            if (farenheit) {
                rData.AlarmHigh = settingsTemp(rData.AlarmHigh, farenheit);
                rData.AlarmCrit = settingsTemp(rData.AlarmCrit, farenheit);
            }
            this.update = buildOpts(rData, aData);
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
        }
        //{"cpu": true, "hdd": "", "ext": "", "mode": "MAX", "Farenheit": false,
        //"AlarmHigh": 65, "AlarmCrit": 80, "AlarmShutdown": true}
        var dlgData = [{
                param: "cpu",
                text: "CPU",
                value: aData.cpu,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Use CPU temperature input. Default is true."
            }, {
                param: "hdd",
                text: "HDD",
                value: aData.hdd,
                type: "text",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Use HDD temperature input. Default is empty. Enter HDD to measure here (/dev/sdx)."
            }, {
                param: "ext",
                text: "External",
                value: aData.ext,
                type: "text",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Use external temperature input. Default is empty. Enter temperature file here (/run/tempx)."
            }, {
                param: "mode",
                text: "Mode",
                value: aData.mode,
                type: "select",
                opts: ["MIN", "AVG", "MAX"],
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Is the mode used to read the temperature. Default is MAX.<br>" +
    				     "MIN: Use the minimum temperature from all sensors used.<br>" +
                         "AVG: Use the average temperature from all sensors used.<br>" +
    				     "MAX: Use the maximum temperature from all sensors used."
            }, {
                param: "Farenheit",
                text: "Farenheit",
                value: aData.Farenheit,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Display the temperature in &#176;F. Default is false (temperature is displayed in &#176;C)."
            }, {
                param: "AlarmHigh",
                text: "Alarm high [" + tempUnit + "]",
                value: displayTemp(aData.AlarmHigh, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Temperature to rise a temperature high alarm. Default is " +
                          displayTemp(65, farenheit).toString() + " " + tempUnit + "."
            }, {
                param: "AlarmCrit",
                text: "Alarm critical [" + tempUnit + "]",
                value: displayTemp(aData.AlarmCrit, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Temperature to rise a temperature critical alarm. Default is " +
                          displayTemp(80, farenheit).toString() + " " + tempUnit + "."
            }, {
                param: "AlarmShutdown",
                text: "Alarm shutdown",
                value: aData.AlarmShutdown,
                type: "boolean",
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Will the system shutdown at critical temperature. Default is true."
            }
        ];
        this.pane.getSettingsEditForm().setData(dlgData);
    }

    btnUpdateCallback() {
        var cbYes = function() {
            var settings = {};
            settings.temp = this.update;
            this.pane.dispose();
            this.displaySettings("Updating settings...");
            runCmd.call(this, this.getSettings, ['set'], settings);
        };
        if (Object.keys(this.update).length > 0) {
            var txt = "Are you sure to update settings and restart smartfancontrol services?"
            new confirmDialog(this, "Update settings", txt, cbYes);
        } else {
            new msgBox(this, "No settings changed", "No update required!");
        }
    }
}

class sfcCtrl {
    constructor(el) {
        this.el = el;
        this.name = "control settings";
        this.pane = new tabPane(this, el, this.name);
        this.update = [];
        this.btnUpdate = null;
    }

    displayContent(el) {
        this.displaySettings();
        this.getSettings();
    }

    displaySettings(text = "") {
        this.pane.dispose();
        this.pane.build(text, true);
        this.pane.getTitle().innerHTML = this.name.charAt(0).toUpperCase() + this.name.slice(1);
        this.btnUpdate = this.pane.addButton("Update", "Update", this.btnUpdateCallback, true, (Object.keys(this.update).length == 0), false);
    }

    getSettings(callback) {
        var cb = function(data) {
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
            var iData = JSON.parse(data);
            this.buildEditForm(iData.control, iData.temp.Farenheit);
        }
        this.update = [];
        runCmd.call(this, cb, ['get']);
    }

    buildEditForm(aData, farenheit) {
        var tempUnit = "&#176;C";
        if (farenheit) {
            tempUnit = "&#176;F";
        }
        var settingsCallback = function(param, value) {
            var rData = this.pane.getSettingsEditForm().getData();
            if (farenheit) {
                rData.TempOn = settingsTemp(rData.TempOn, farenheit);
                rData.TempHyst = settingsTemp(rData.TempHyst, farenheit);
                rData.TempStart = settingsTemp(rData.TempStart, farenheit);
                rData.TempFull = settingsTemp(rData.TempFull, farenheit);
                rData.LinSteps = settingsTemp(rData.LinSteps, farenheit);
            }
            this.update = buildOpts(rData, aData);
            this.pane.setButtonDisabled(this.btnUpdate, (Object.keys(this.update).length == 0));
        }
        //{"mode": "PI", "TempOn": 55, "TempHyst": 5, "TempStart": 45, "TempFull": 65,
        //"LinSteps": 2.5, "Frequency": 1, "Pgain": 0.0, "Igain": 0.0}
        var dlgData = [{
            param: "mode",
                text: "Mode",
                value: aData.mode,
                type: "select",
                opts: ["ONOFF", "LINEAR", "PI"],
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "Is the mode used to control the temperature loop. Default is LINEAR.<br>" +
                         "ONOFF: Only on/ off control is used, if this mode is selected, on/off " +
                         "control will also be used to control the fan.<br>" +
                         "LINEAR: If the temperature is within the linear range, the fan speed <br>" +
                         "will increase linear with a temperature increase.<br>" +
                         "PI: PI temperature control is used."
            }, {
                param: "TempOn",
                text: "On temperature [" + tempUnit + "]",
                value: displayTemp(aData.TempOn, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The temperature to switch the fan on. Default is " +
                          displayTemp(55, farenheit).toString() + " " + tempUnit + " in ONOFF mode. " +
                          "In other modes this is the idle running temperature (minimum RPM or PWM). Set > TempStart if not used."
            }, {
                param: "TempHyst",
                text: "Hysteresis [" + tempUnit + "]",
                value: displayTemp(aData.TempHyst, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The temperature hysteresis to switch the fan off again. Default is " +
                          displayTemp(5, farenheit).toString() + " " + tempUnit + ". Only used in ONOFF mode."
            }, {
                param: "TempStart",
                text: "Start temperature [" + tempUnit + "]",
                value: displayTemp(aData.TempStart, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The temperature to start the fan controller. Default is " +
                          displayTemp(45, farenheit).toString() + " " + tempUnit + ". Only used in LINEAR and PI mode."
            }, {
                param: "TempFull",
                text: "Full temperature [" + tempUnit + "]",
                value: displayTemp(aData.TempFull, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The temperature on which the fan controller should run full speed. Default is " +
                          displayTemp(65, farenheit).toString() + " " + tempUnit + ". Only used in LINEAR and PI mode."
            }, {
                param: "LinSteps",
                text: "Linear steps",
                value: displayTemp(aData.LinSteps, farenheit),
                type: "number",
                min: 0,
                max: 250,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The temperature steps/ hysteresis. To prevent oscillating on small temperature changes. " +
    					 "Default is " + displayTemp(2.5, farenheit).toString() + " " + tempUnit + ". Only used in LINEAR mode."
            }, {
                param: "Frequency",
                text: "Frequency [Hz]",
                value: aData.Frequency,
                type: "number",
                min: 0,
                max: 100,
                step: 1,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The frequency of the temperature control loop in Hz. default is 1."
            }, {
                param: "Pgain",
                text: "P gain",
                value: aData.Pgain,
                type: "number",
                min: 0,
                max: 10000,
                step: 0.001,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The P gain of the temperature control loop. Default is 10. Only used in PI mode."
            }, {
                param: "Igain",
                text: "I gain",
                value: aData.Igain,
                type: "number",
                min: 0,
                max: 10000,
                step: 0.001,
                onchange: settingsCallback,
                disabled: false,
                readonly: false,
                comment: "The I gain of the temperature control loop. Default is 0.1. Only used in PI mode."
            }
        ];
        this.pane.getSettingsEditForm().setData(dlgData);
    }

    btnUpdateCallback() {
        var cbYes = function() {
            var settings = {};
            settings.control = this.update;
            this.pane.dispose();
            this.displaySettings("Updating settings...");
            runCmd.call(this, this.getSettings, ['set'], settings);
        };
        if (Object.keys(this.update).length > 0) {
            var txt = "Are you sure to update settings and restart smartfancontrol services?"
            new confirmDialog(this, "Update settings", txt, cbYes);
        } else {
            new msgBox(this, "No settings changed", "No update required!");
        }
    }
}

/////////////////////
// Common functions //
//////////////////////

function runCmd(callback, args = [], json = null, cmd = "/opt/smartfancontrol/smartfancontrol-cli.py") {
    var cbDone = function(data) {
        callback.call(this, data);
    };
    var cbFail = function(message, data) {
        callback.call(this, "[]");
        new msgBox(this, "SmartFanControl command failed", "Command error: " + (data ? data : message + "<br>Please check the log file"));
    };
    var command = [cmd];
    command = command.concat(args);
    if (json) {
        command = command.concat(JSON.stringify(json));
    }
    return cockpit.spawn(command, { err: "out", superuser: "require" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
}

function runLog(callback, args = [], cmd = "/opt/smartfancontrol/smartfancontrol-logger.py") {
    var cbDone = function(data) {
        callback.call(this, data, 0);
    };
    var cbFail = function(message, data) {
        callback.call(this, "[]", 1);
        //new msgBox(this, "SmartFanControl command failed", "Command error: " + (data ? data : message));
    };
    var command = [cmd];
    command = command.concat(args);
    return cockpit.spawn(command, { err: "out", superuser: "require" })
        .done(cbDone.bind(this))
        .fail(cbFail.bind(this));
}

function buildOpts(data, refData = {}, exclude = []) {
    var opts = {};

    for (let key in data) {
        let addKey = true;
        if (exclude.includes(key)) {
            addKey = false;
        } else if (key in refData) {
            if (data2str(data[key]) == data2str(refData[key])) {
                addKey = false;
            }
        }
        if (addKey) {
            opts[key] = data[key];
        }
    }
    return opts;
}

function data2str(data) {
    var str = "";
    if (Array.isArray(data)) {
        str = data.map(s => s.trim()).join(",");
    } else {
        str = data.toString();
    }
    return str;
}

function cs2arr(data, force = true) {
    var arr = [];
    if ((force) || (data.includes(","))) {
        arr = data.split(",").map(s => s.trim());
    } else {
        arr = data;
    }

    return arr;
}

function celcius2farenheit(temp) {
    return (temp * 1.8) + 32;
}

function farenheit2celcius(temp) {
    return (temp - 32) / 1.8;
}

function displayTemp(temp, farenheit) {
    var rtemp = temp;
    if (farenheit) {
        rtemp = +celcius2farenheit(temp).toFixed(1);
    }
    return rtemp;
}

function settingsTemp(temp, farenheit) {
    var rtemp = temp;
    if (farenheit) {
        rtemp = +farenheit2celcius(temp).toFixed(1);
    }
    return rtemp;
}

///////////////////////////
// Tab display functions //
///////////////////////////

function clickTab() {
    // remove active class from all elements
    document.querySelectorAll('[role="presentation"]').forEach(function (el) {
        el.classList.remove("active");
        el.getElementsByTagName("a")[0].setAttribute("tabindex", -1);
        el.getElementsByTagName("a")[0].setAttribute("aria-selected", false);
    });

    // add class 'active' to this element
    this.classList.add("active")
    this.getElementsByTagName("a")[0].setAttribute("aria-selected", true);
    this.getElementsByTagName("a")[0].removeAttribute("tabindex");

    // hide all contents
    document.querySelectorAll('[role="tabpanel"]').forEach(function (el) {
        el.setAttribute("aria-hidden", true);
        el.classList.remove("active");
        el.classList.remove("in");
    });

    // show current contents
    contentId = this.getElementsByTagName("a")[0].getAttribute("aria-controls");
    el = document.getElementById(contentId);

    el.setAttribute("aria-hidden", false);
    el.classList.add("active");
    el.classList.add("in");
    displayContent(el);
}

function displayContent(el) {
    if (el.id.search("monitor") >= 0) {
        let Monitor = new sfcMonitor(el);
        Monitor.displayContent();
    } else if (el.id.search("fan") >= 0) {
            let Fan = new sfcFan(el);
            Fan.displayContent();
    } else if (el.id.search("temp") >= 0) {
            let Temp = new sfcTemp(el);
            Temp.displayContent();
    } else if (el.id.search("ctrl") >= 0) {
            let Ctrl = new sfcCtrl(el);
            Ctrl.displayContent();
    } else if (el.id.search("log") >= 0) {
        let Logger = new logger(el, "/var/log/smartfancontrol.log");
        Logger.displayContent();
    }
}

function displayFirstPane() {
    displayContent(document.querySelectorAll('[role="tabpanel"]')[0]);
}

document.querySelectorAll('[role="presentation"]').forEach(function (el) {
    el.addEventListener("click", clickTab);
});

displayFirstPane();

// Send a 'init' message.  This tells integration tests that we are ready to go
cockpit.transport.wait(function() { });
