import os

def get_loaded_domains() -> dict[str, str]:
    with open("/etc/dnsmasq.hosts") as f:
        return {
            l.split()[1]: l.split()[0] for l in f.read().split('\n') if len(l) != 0
        }

def reg_new_domain(
        domain: str,
        ip: str
) -> bool:
    domains = get_loaded_domains()
    if domain in domains:
        return False
    
    domains[domain] = ip
    with open("/etc/dnsmasq.hosts", 'w') as f:
        f.write("\n".join([f"{ip} {dm}" for (dm, ip) in domains.items()]))

    return True

def del_domain(
        domain: str
) -> bool:
    domains = get_loaded_domains()
    if domain not in domains:
        return False
    
    del domains[domain]
    with open("/etc/dnsmasq.hosts", 'w') as f:
        f.write("\n".join([f"{ip} {dm}" for (dm, ip) in domains.items()]))

    return True

def reload_domains():
    os.system("sudo kill -HUP $(pgrep dnsmasq)")

def enable(
        ip: str,
        port: int,
        intrf: str
):
    with open("/etc/dnsmasq.conf", 'w') as f:
        f.write(f"""
listen-address={ip}
port={port}
interface={intrf}
no-hosts
addn-hosts=/etc/dnsmasq.hosts
server=8.8.8.8
"""[1:-1])
        os.system("sudo systemctl restart dnsmasq")

def stop():
    os.system("sudo systemctl stop dnsmasq")