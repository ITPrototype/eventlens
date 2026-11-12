"""Synthetic Windows events — used when not running on Windows (or EV_DEMO=1)."""
import random
import time

SERVICES = ["Windows Update", "Background Intelligent Transfer Service", "Print Spooler",
            "Windows Modules Installer", "Microsoft Defender Antivirus Service", "Software Protection",
            "Windows Search", "Application Information", "Remote Desktop Services", "DNS Client",
            "DHCP Client", "Windows Time", "Task Scheduler", "Windows Audio"]
USERS = ["alisher", "dilnoza", "svc_backup", "administrator", "j.karimov", "svc_sql", "malika"]
PROCS = ["chrome.exe", "explorer.exe", "outlook.exe", "Teams.exe", "sqlservr.exe", "w3wp.exe",
         "backup_agent.exe", "svchost.exe", "powershell.exe", "msedge.exe"]
INT_IPS = ["10.0.4.21", "10.0.4.35", "10.0.7.12", "192.168.1.14", "10.0.4.90"]
WS = ["PC-ACC-01", "PC-HR-04", "LAPTOP-DIL", "SRV-FILE01", "PC-DEV-07"]
ATTACKER = "203.0.113.77"

SID = "S-1-5-21-3623811015-3361044348-30300820-"


def _sid(r):
    return SID + str(1000 + r.randint(0, 40))


# ---- message builders (r = random.Random) --------------------------------

def m_7036(r):
    return f"The {r.choice(SERVICES)} service entered the {r.choice(['running', 'running', 'stopped'])} state."

def m_7040(r):
    return f"The start type of the {r.choice(SERVICES)} service was changed from demand start to auto start."

def m_7034(r):
    return f"The {r.choice(SERVICES)} service terminated unexpectedly.  It has done this 1 time(s)."

def m_7045(r):
    s = r.choice(SERVICES)
    return (f"A service was installed in the system.\r\n\r\nService Name:  {s}\r\n"
            f"Service File Name:  C:\\Program Files\\Vendor\\{s.split()[0].lower()}svc.exe\r\n"
            "Service Type:  user mode service\r\nService Start Type:  auto start\r\nService Account:  LocalSystem")

def m_10016(r):
    return ("The machine-default permission settings do not grant Local Activation permission for the COM Server "
            "application with CLSID\r\n{2593F8B9-4EAF-457C-B68A-50F6B8EA6B54}\r\n and APPID\r\n"
            "{15C20B67-12E7-4BB6-92BB-7AFF07997402}\r\n to the user CORP\\" + r.choice(USERS) +
            " SID (" + _sid(r) + ") from address LocalHost (Using LRPC) running in the application container "
            "Unavailable SID (Unavailable). This security permission can be modified using the Component Services "
            "administrative tool.")

def m_ntp(r):
    return ("NtpClient was unable to set a manual peer to use as a time source because of DNS resolution error on "
            "'time.windows.com,0x8'. NtpClient will try again in 15 minutes and double the reattempt interval thereafter.")

def m_tcpip(r):
    return ("TCP/IP failed to establish an outgoing connection because the selected local endpoint was recently used "
            "to connect to the same remote endpoint. This error typically occurs when outgoing connections are opened "
            "and closed at a high rate, causing all available local ports to be used.")

def m_schannel(r):
    return "A fatal alert was received from the remote endpoint. The TLS protocol defined fatal alert code is 46."

def m_wu19(r):
    return ("Installation Successful: Windows successfully installed the following update: "
            f"2026-10 Cumulative Update for Windows 11 Version 23H2 (KB50{r.randint(10000, 99999)})")

def m_wu43(r):
    return f"Installation Started: Windows has started installing the following update: Security Intelligence Update (KB2267602)"

def m_wlan(r):
    return ("WLAN AutoConfig service has successfully connected to a wireless network.\r\n\r\n"
            "Network Adapter: Intel(R) Wi-Fi 6 AX201 160MHz\r\nSSID: Office-WiFi\r\nAuthentication: WPA2-Personal")

def m_gp(r):
    return ("The processing of Group Policy failed because of lack of network connectivity to a domain controller. "
            "This may be a transient condition. A success message would be generated once the machine gets connected "
            "to the domain controller and Group Policy has succesfully processed.")

def m_netlogon(r):
    return ("The session setup from the computer " + r.choice(WS) + " failed to authenticate. The name of the "
            "account referenced in the security database is " + r.choice(WS) + "$.  The following error occurred:\r\n"
            "Access is denied.")

def m_disk153(r):
    return f"The IO operation at logical block address 0x{r.randint(0x100000, 0xFFFFFFF):x} for Disk 0 was retried."

def m_pnp(r):
    return "The driver \\Driver\\WudfRd failed to load for the device SWD\\WPDBUSENUM\\_??_USBSTOR#Disk&Ven_Generic."

def m_1074(r):
    return ("The process C:\\Windows\\System32\\RuntimeBroker.exe (SRV01) has initiated the restart of computer SRV01 "
            "on behalf of user CORP\\" + r.choice(USERS) + " for the following reason: Operating System: Recovery (Planned)\r\n"
            "Reason Code: 0x80020002\r\nShutdown Type: restart")

def m_1000(r, proc=None):
    p = proc or r.choice(PROCS)
    return (f"Faulting application name: {p}, version: 120.0.6099.109, time stamp: 0x65853f2e\r\n"
            "Faulting module name: ntdll.dll, version: 10.0.22621.2506, time stamp: 0x2f4a3b11\r\n"
            "Exception code: 0xc0000005\r\nFault offset: 0x000000000009d7f4\r\n"
            f"Faulting process id: 0x{r.randint(0x400, 0x2fff):x}\r\n"
            f"Faulting application start time: 0x01da{r.randint(0x1000000, 0xfffffff):x}\r\n"
            f"Faulting application path: C:\\Program Files\\App\\{p}\r\n"
            "Faulting module path: C:\\Windows\\SYSTEM32\\ntdll.dll")

def m_1002(r):
    return f"The program {r.choice(PROCS)} version 1.0.0.0 stopped interacting with Windows and was closed."

def m_wer(r):
    return (f"Fault bucket {r.randint(10**18, 10**19 - 1)}, type 5\r\nEvent Name: APPCRASH\r\nResponse: Not available\r\n"
            f"Cab Id: 0\r\n\r\nProblem signature:\r\nP1: {r.choice(PROCS)}\r\nP2: 1.0.0.0")

def m_net(r):
    return (f"Application: {r.choice(PROCS)}\r\nFramework Version: v4.0.30319\r\n"
            "Description: The process was terminated due to an unhandled exception.\r\n"
            "Exception Info: System.NullReferenceException: Object reference not set to an instance of an object.")

def m_msi(r):
    return "Product: Microsoft Edge WebView2 Runtime -- Installation completed successfully."

def m_secctr(r):
    return "The Windows Security Center Service has been started."

def m_sppsvc(r):
    return "Successfully scheduled Software Protection service for re-start at 2026-11-02T08:15:00Z. Reason: RulesEngine."

def m_vss(r):
    return ("Volume Shadow Copy Service error: Unexpected error calling routine CoCreateInstance.  "
            "hr = 0x80040154, Class not registered.")

def m_esent(r):
    return "svchost (4216,D,50) SRUJet: The database engine has successfully completed recovery steps."


def m_4624(r, ip=None, user=None, lt=None):
    ip = ip or r.choice(INT_IPS)
    user = user or r.choice(USERS)
    lt = lt or r.choice([2, 3, 3, 3, 5, 10])
    return ("An account was successfully logged on.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-5-18\r\n"
            "\tAccount Name:\t\tSRV01$\r\n\tAccount Domain:\t\tCORP\r\n\tLogon ID:\t\t0x3E7\r\n\r\n"
            f"Logon Information:\r\n\tLogon Type:\t\t{lt}\r\n\r\nNew Logon:\r\n\tSecurity ID:\t\t{_sid(r)}\r\n"
            f"\tAccount Name:\t\t{user}\r\n\tAccount Domain:\t\tCORP\r\n\r\nNetwork Information:\r\n"
            f"\tWorkstation Name:\t{r.choice(WS)}\r\n\tSource Network Address:\t{ip}\r\n\tSource Port:\t\t{r.randint(49152, 65535)}")

def m_4625(r, ip=None, user=None):
    ip = ip or r.choice(INT_IPS)
    user = user or r.choice(USERS)
    return ("An account failed to log on.\r\n\r\nSubject:\r\n\tSecurity ID:\t\tS-1-0-0\r\n\tAccount Name:\t\t-\r\n"
            "\tAccount Domain:\t\t-\r\n\tLogon ID:\t\t0x0\r\n\r\nLogon Type:\t\t\t3\r\n\r\n"
            f"Account For Which Logon Failed:\r\n\tSecurity ID:\t\tS-1-0-0\r\n\tAccount Name:\t\t{user}\r\n"
            "\tAccount Domain:\t\tCORP\r\n\r\nFailure Information:\r\n\tFailure Reason:\t\tUnknown user name or bad password.\r\n"
            "\tStatus:\t\t\t0xC000006D\r\n\tSub Status:\t\t0xC000006A\r\n\r\nNetwork Information:\r\n"
            f"\tWorkstation Name:\t{r.choice(WS)}\r\n\tSource Network Address:\t{ip}\r\n\tSource Port:\t\t{r.randint(49152, 65535)}")

def m_4634(r):
    return ("An account was logged off.\r\n\r\nSubject:\r\n\tSecurity ID:\t\t" + _sid(r) + "\r\n\tAccount Name:\t\t" +
            r.choice(USERS) + "\r\n\tAccount Domain:\t\tCORP\r\n\r\nLogon Type:\t\t\t3")

def m_4672(r):
    return ("Special privileges assigned to new logon.\r\n\r\nSubject:\r\n\tSecurity ID:\t\t" + _sid(r) +
            "\r\n\tAccount Name:\t\t" + r.choice(USERS) + "\r\n\tAccount Domain:\t\tCORP\r\n\r\nPrivileges:\t\tSeSecurityPrivilege\r\n\t\t\tSeBackupPrivilege")

def m_4688(r):
    return ("A new process has been created.\r\n\r\nCreator Subject:\r\n\tAccount Name:\t\t" + r.choice(USERS) +
            "\r\n\r\nProcess Information:\r\n\tNew Process Name:\tC:\\Windows\\System32\\" + r.choice(PROCS) +
            "\r\n\tToken Elevation Type:\tTokenElevationTypeDefault (1)")

def m_4648(r):
    return ("A logon was attempted using explicit credentials.\r\n\r\nSubject:\r\n\tAccount Name:\t\t" + r.choice(USERS) +
            "\r\n\r\nAccount Whose Credentials Were Used:\r\n\tAccount Name:\t\t" + r.choice(USERS))

def m_4776(r):
    return ("The computer attempted to validate the credentials for an account.\r\n\r\nAuthentication Package:\tMICROSOFT_AUTHENTICATION_PACKAGE_V1_0\r\n"
            f"Logon Account:\t{r.choice(USERS)}\r\nSource Workstation:\t{r.choice(WS)}\r\nError Code:\t0x0")

def m_4769(r):
    return ("A Kerberos service ticket was requested.\r\n\r\nAccount Information:\r\n\tAccount Name:\t\t" + r.choice(USERS) +
            "@CORP.LOCAL\r\n\r\nService Information:\r\n\tService Name:\t\tSRV-FILE01$")

def m_5156(r):
    return ("The Windows Filtering Platform has permitted a connection.\r\n\r\nApplication Information:\r\n\tProcess ID:\t\t"
            f"{r.randint(400, 9000)}\r\n\tApplication Name:\t\\device\\harddiskvolume3\\windows\\system32\\{r.choice(PROCS)}\r\n\r\n"
            f"Network Information:\r\n\tDirection:\t\tOutbound\r\n\tSource Address:\t\t10.0.4.1\r\n\tDestination Address:\t{r.choice(INT_IPS)}\r\n\tDestination Port:\t443")

def m_4798(r):
    return "A user's local group membership was enumerated.\r\n\r\nUser:\r\n\tAccount Name:\t\t" + r.choice(USERS)


# (source, id, level, weight, builder, keywords)
SYSTEM = [
    ("Service Control Manager", 7036, 4, 34, m_7036, "Classic"),
    ("Service Control Manager", 7040, 4, 2, m_7040, "Classic"),
    ("Service Control Manager", 7034, 2, 1.2, m_7034, "Classic"),
    ("Service Control Manager", 7045, 4, 0.4, m_7045, "Classic"),
    ("Microsoft-Windows-DistributedCOM", 10016, 2, 16, m_10016, "Classic"),
    ("Microsoft-Windows-Time-Service", 134, 3, 3, m_ntp, ""),
    ("Tcpip", 4227, 3, 1.2, m_tcpip, "Classic"),
    ("Schannel", 36887, 2, 2.5, m_schannel, ""),
    ("Microsoft-Windows-WindowsUpdateClient", 19, 4, 2, m_wu19, ""),
    ("Microsoft-Windows-WindowsUpdateClient", 43, 4, 2, m_wu43, ""),
    ("Microsoft-Windows-WLAN-AutoConfig", 8001, 4, 1, m_wlan, ""),
    ("Microsoft-Windows-GroupPolicy", 1129, 3, 1, m_gp, ""),
    ("NETLOGON", 5719, 2, 0.6, m_netlogon, "Classic"),
    ("Disk", 153, 3, 0.5, m_disk153, "Classic"),
    ("Microsoft-Windows-Kernel-PnP", 219, 3, 0.5, m_pnp, ""),
    ("User32", 1074, 4, 0.3, m_1074, "Classic"),
]
APPLICATION = [
    ("Application Error", 1000, 2, 3, m_1000, "Classic"),
    ("Application Hang", 1002, 2, 1, m_1002, "Classic"),
    ("Windows Error Reporting", 1001, 4, 3, m_wer, "Classic"),
    (".NET Runtime", 1026, 2, 1, m_net, "Classic"),
    ("MsiInstaller", 11707, 4, 1.2, m_msi, "Classic"),
    ("SecurityCenter", 15, 4, 2, m_secctr, "Classic"),
    ("Software Protection Platform Service", 16384, 4, 2.5, m_sppsvc, "Classic"),
    ("VSS", 8193, 2, 0.4, m_vss, "Classic"),
    ("ESENT", 508, 4, 4, m_esent, "Classic"),
]
SECURITY = [
    ("Microsoft-Windows-Security-Auditing", 4624, 0, 40, m_4624, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4634, 0, 25, m_4634, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4672, 0, 10, m_4672, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4688, 0, 12, m_4688, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4648, 0, 2, m_4648, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4776, 0, 3, m_4776, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4769, 0, 6, m_4769, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4798, 0, 2, m_4798, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 5156, 0, 15, m_5156, "Audit Success"),
    ("Microsoft-Windows-Security-Auditing", 4625, 0, 1.5, m_4625, "Audit Failure"),
]
RATES = {"Application": 260, "System": 420, "Security": 900}
TPL = {"Application": APPLICATION, "System": SYSTEM, "Security": SECURITY}
GENERIC = [("Microsoft-Windows-Generic", 100, 4, 5, lambda r: "Operational event (demo data).", ""),
           ("Microsoft-Windows-Generic", 101, 3, 1, lambda r: "Something took longer than expected (demo data).", "")]


def _ev(t, log, host, src, id_, lvl, msg, kw="", r=None, user=None):
    return {
        "t": int(t), "id": id_, "lvl": lvl, "log": log, "src": src, "host": host, "rec": 0,
        "task": "None" if kw != "Audit Success" and kw != "Audit Failure" else "Logon",
        "kw": kw, "pid": (r.randint(4, 9000) if r else 4), "user": user or "S-1-5-18", "msg": msg,
    }


def generate(log, hours, mx, host):
    now = time.time() * 1000
    span_h = hours if hours > 0 else 720
    span = span_h * 3600 * 1000
    r = random.Random("ev-" + log)
    tpls = TPL.get(log, GENERIC)
    rate = RATES.get(log, 120)
    n = max(10, min(int(rate * span_h / 24), mx))
    weights = [t[3] for t in tpls]
    out = []
    for _ in range(n):
        src, id_, lvl, _w, fn, kw = r.choices(tpls, weights)[0]
        off = (r.random() ** 1.15) * span
        out.append(_ev(now - off, log, host, src, id_, lvl, fn(r), kw, r))

    def at(frac, plus_s=0):
        return now - (1 - frac) * span + plus_s * 1000 - (60_000 if frac > 0.97 else 0)

    if log == "System":
        t0 = at(0.62)
        for k in range(3):
            out.append(_ev(t0 - 60_000 + k * 9000, log, host, "Disk", 153, 3, m_disk153(r), "Classic", r))
        out.append(_ev(t0 + 5000, log, host, "EventLog", 6005, 4, "The Event log service was started.", "Classic", r))
        out.append(_ev(t0 + 6000, log, host, "EventLog", 6013, 4, "The system uptime is 6 seconds.", "Classic", r))
        out.append(_ev(t0 + 8000, log, host, "Microsoft-Windows-Kernel-Power", 41, 1,
                       "The system has rebooted without cleanly shutting down first. This error could be caused if the "
                       "system stopped responding, crashed, or lost power unexpectedly.", "", r))
        out.append(_ev(t0 + 9000, log, host, "EventLog", 6008, 2,
                       "The previous system shutdown at 3:12:44 AM on 10/29/2026 was unexpected.", "Classic", r))
        out.append(_ev(t0 + 40_000, log, host, "Microsoft-Windows-WER-SystemErrorReporting", 1001, 2,
                       "The computer has rebooted from a bugcheck.  The bugcheck was: 0x00000133 (0x0000000000000001, "
                       "0x0000000000001e00, 0x0000000000000000, 0x0000000000000000). A dump was saved in: C:\\Windows\\MEMORY.DMP.",
                       "Classic", r))
        for k in range(14):
            out.append(_ev(t0 + 12_000 + k * 5000, log, host, "Service Control Manager", 7036, 4, m_7036(r), "Classic", r))
        out.append(_ev(t0 + 70_000, log, host, "Service Control Manager", 7034, 2,
                       "The Print Spooler service terminated unexpectedly.  It has done this 2 time(s).", "Classic", r))
        out.append(_ev(at(0.30), log, host, "Service Control Manager", 7045, 4,
                       "A service was installed in the system.\r\n\r\nService Name:  RemoteSupportHelper\r\n"
                       "Service File Name:  C:\\Users\\Public\\rsh.exe -k netsvcs\r\nService Type:  user mode service\r\n"
                       "Service Start Type:  auto start\r\nService Account:  LocalSystem", "Classic", r))
    elif log == "Application":
        t0 = at(0.42)
        for k in range(5):
            out.append(_ev(t0 + k * 22_000, log, host, "Application Error", 1000, 2, m_1000(r, "chrome.exe"), "Classic", r))
        out.append(_ev(t0 + 130_000, log, host, "Application Hang", 1002, 2, m_1002(r), "Classic", r))
    elif log == "Security":
        t0 = at(0.35)
        names = ["administrator", "admin", "sa", "backup", "test", "user1", "root"]
        for k in range(72):
            out.append(_ev(t0 + k * 9000 + r.randint(0, 3000), log, host, "Microsoft-Windows-Security-Auditing", 4625, 0,
                           m_4625(r, ATTACKER, names[k % len(names)]), "Audit Failure", r))
        t1 = t0 + 72 * 9000 + 20_000
        out.append(_ev(t1, log, host, "Microsoft-Windows-Security-Auditing", 4624, 0,
                       m_4624(r, ATTACKER, "svc_backup", 3), "Audit Success", r))
        out.append(_ev(t1 + 40_000, log, host, "Microsoft-Windows-Security-Auditing", 4732, 0,
                       "A member was added to a security-enabled local group.\r\n\r\nMember:\r\n\tAccount Name:\t\tCN=svc_backup\r\n\r\n"
                       "Group:\r\n\tSecurity ID:\t\tS-1-5-32-544\r\n\tGroup Name:\t\tAdministrators", "Audit Success", r))

    out.sort(key=lambda e: e["t"], reverse=True)
    out = out[:mx]
    for i, e in enumerate(reversed(out)):
        e["rec"] = 100000 + i
    return out


def xml_for(log, rec, id_, src, t, host, lvl):
    from datetime import datetime, timezone
    ts = datetime.fromtimestamp(int(t or 0) / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f0Z")
    return (f'<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">\n'
            f'  <System>\n    <Provider Name="{src}" />\n    <EventID>{id_}</EventID>\n    <Level>{lvl}</Level>\n'
            f'    <TimeCreated SystemTime="{ts}" />\n    <EventRecordID>{rec}</EventRecordID>\n'
            f'    <Channel>{log}</Channel>\n    <Computer>{host}</Computer>\n  </System>\n'
            f'  <EventData>\n    <Data Name="Demo">synthetic event (demo mode)</Data>\n  </EventData>\n</Event>')
