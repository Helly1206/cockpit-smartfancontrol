#!/usr/bin/python3

# -*- coding: utf-8 -*-
#########################################################
# SERVICE : database.py                                 #
#           database funcitons for automating           #
#           smartfancontrol for commandline or app.     #
#           I. Helwegen 2020                            #
#########################################################

####################### IMPORTS #########################
import os
import xml.etree.ElementTree as ET
from xml.dom.minidom import parseString

#########################################################

####################### GLOBALS #########################
XML_FILENAME = "smartfancontrol.xml"
ENCODING     = 'utf-8'
#########################################################

###################### FUNCTIONS ########################

#########################################################
# Class : database                                      #
#########################################################
class database(object):
    def __init__(self):
        self.db = {}
        if not self.getXMLpath(False):
            print("XML file not found. Create XML file manually or down load from:")
            print("https://raw.githubusercontent.com/Helly1206/smartfancontrol/master/etc/smartfancontrol.xml")
            exit(1)
        else:
            self.getXML()

    def __del__(self):
        del self.db
        self.db = {}

    def __call__(self):
        return self.db

    def update(self):
        self.updateXML()

    def reload(self):
        del self.db
        self.db = {}
        self.getXML()

    def bl(self, val):
        retval = False
        try:
            f = float(val)
            if f > 0:
                retval = True
        except:
            if val.lower() == "true" or val.lower() == "yes" or val.lower() == "1":
                retval = True
        return retval

################## INTERNAL FUNCTIONS ###################

    def gettype(self, text, txtype = True):
        try:
            retval = int(text)
        except:
            try:
                retval = float(text)
            except:
                if text:
                    if text.lower() == "false":
                        retval = False
                    elif text.lower() == "true":
                        retval = True
                    elif txtype:
                        retval = text
                    else:
                        retval = ""
                else:
                    retval = ""

        return retval

    def settype(self, element):
        retval = ""
        if type(element) == bool:
            if element:
                retval = "true"
            else:
                retval = "false"
        elif element != None:
            retval = str(element)

        return retval

    def getXML(self):
        XMLpath = self.getXMLpath()
        try:
            tree = ET.parse(XMLpath)
            root = tree.getroot()
            self.db = self.parseKids(root, True)
        except Exception as e:
            print("Error parsing xml file")
            print("Check XML file syntax for errors")
            print(e)
            exit(1)

    def parseKids(self, item, isRoot = False):
        db = {}
        if self.hasKids(item):
            for kid in item:
                if self.hasKids(kid):
                    db[kid.tag] = self.parseKids(kid)
                else:
                    db.update(self.parseKids(kid))
        elif not isRoot:
            db[item.tag] = self.gettype(item.text)
        return db

    def hasKids(self, item):
        retval = False
        for kid in item:
            retval = True
            break
        return retval

    def updateXML(self):
        db = ET.Element('settings')
        pcomment = self.getXMLcomment("settings")
        if pcomment:
            comment = ET.Comment(pcomment)
            db.append(comment)
        self.buildXML(db, self.db)

        XMLpath = self.getXMLpath(dowrite = True)

        with open(XMLpath, "w") as xml_file:
            xml_file.write(self.prettify(db))

    def buildXML(self, xmltree, item):
        if isinstance(item, dict):
            for key, value in item.items():
                kid = ET.SubElement(xmltree, key)
                self.buildXML(kid, value)
        else:
            xmltree.text = self.settype(item)

    def getXMLcomment(self, tag):
        comment = ""
        XMLpath = self.getXMLpath()
        with open(XMLpath, 'r') as xml_file:
            content = xml_file.read()
            if tag:
                xmltag = "<{}>".format(tag)
                xmlend = "</{}>".format(tag)
                begin = content.find(xmltag)
                end = content.find(xmlend)
                content = content[begin:end]
            cmttag = "<!--"
            cmtend = "-->"
            begin = content.find(cmttag)
            end = content.find(cmtend)
            if (begin > -1) and (end > -1):
                comment = content[begin+len(cmttag):end]
        return comment

    def prettify(self, elem):
        """Return a pretty-printed XML string for the Element.
        """
        rough_string = ET.tostring(elem, ENCODING)
        reparsed = parseString(rough_string)
        return reparsed.toprettyxml(indent="\t").replace('<?xml version="1.0" ?>','<?xml version="1.0" encoding="%s"?>' % ENCODING)

    def getXMLpath(self, doexit = True, dowrite = False):
        etcpath = "/etc/"
        XMLpath = ""
        # first look in etc
        if os.path.isfile(os.path.join(etcpath,XML_FILENAME)):
            XMLpath = os.path.join(etcpath,XML_FILENAME)
            if dowrite and not os.access(XMLpath, os.W_OK):
                print("No valid writable XML file location found")
                print("XML file cannot be written, please run as super user")
                if doexit:
                    exit(1)
        else: # Only allow etc location
            print("No XML file found")
            if doexit:
                exit(1)
        return XMLpath

#########################################################
