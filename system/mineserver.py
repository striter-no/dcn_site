from system.database import DataBase
import hashlib, random, string, time

import logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

def fsha256(inp) -> str:
    return hashlib.sha256(str(inp).encode()).hexdigest()

class Server:
    def __init__(self):
        self.accs_db = DataBase("./runtime/databases/accounts.sqlite3")
        self.domains_db = DataBase("./runtime/databases/domains.sqlite3")
    
        self.current_challange  = ""
        self.prefix_len         = 10
        
        self.current_difficulty = 4
        self.reward = 10

        self.domain_update_cf = 0.2
        self.domain_cost = 50
        self.inflation_len = 5
        self.deflation_len = 20

        self.max_inflation = 20
        self.max_deflation = 10

        self.alph = string.ascii_lowercase + string.digits + '-_.'
        self.turnover = 0

    def _filter_domain(self, domain: str) -> tuple[bool, str]:
        if any([n not in self.alph for n in domain]):
            return False, "forbidden characters, only allowed: " + self.alph
        
        if domain.count('..') != 0:
            return False, "no empty subdomains"

        if len(domain) > 80:
            return False, "domain name cannot be over 80 characters"
        
        return True, "ok"

    def _is_ip_valid(self, ip: str) -> bool:
        if len(ip) > 15 or len(ip) < 7:
            return False
        
        if ip.count('.') != 3:
            return False
        
        if ip in ["0.0.0.0", "127.0.0.1"]:
            return False

        octs = ip.split('.')

        for oc in octs:
            if oc.startswith('0') or not oc.isdigit() or oc.startswith('-'):
                return False
            if int(oc) > 255:
                return False

        return True

    def _calc_domain(self, domain: str, end_of_support: float = 1) -> float:
        ln = len(domain)
        
        if ln >= self.deflation_len:
            return max(
                self.domain_cost / self.max_deflation,
                self.domain_cost * (1 / ln) * end_of_support
            )
        elif ln <= self.inflation_len:
            return max(
                self.domain_cost * self.max_inflation,
                self.domain_cost * ln * end_of_support
            )
        else:
            return self.domain_cost

    def new_challange(self):
        self.current_challange = f"dcn0x{''.join(random.choices(string.ascii_letters + string.digits, k=self.prefix_len))}"

    def new_acc(
            self,
            key: str
    ) -> str:
        acc_addr = fsha256(fsha256(random.randint(-100000000000, 1000000000000) * round(time.time())))
        self.accs_db.set(acc_addr, {
            "keyhash": fsha256(key),
            "balance": 0,
            "domains": []
        })

        return acc_addr

    def new_domain(
            self,
            acc:    str,
            key:    str,
            domain: str,
            ip:     str
    ) -> tuple[bool, str]:
        filt, reason = self._filter_domain(domain)
        if not filt:
            return False, reason
        
        if not self._is_ip_valid(ip):
            return False, "invalid ip"

        if domain in self.domains_db.all():
            return False, "already exists"
        
        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "not registered"
        
        if fsha256(key) != acc_data["keyhash"]:
            return False, "forbidden"

        cost = self._calc_domain(domain)
        if acc_data["balance"] < cost:
            return False, f"cannot afford this cost: {cost}"
        
        acc_data["balance"] -= cost
        acc_data["domains"].append(domain)
        self.accs_db.set(acc, acc_data)
        self.domains_db.set(domain, ip)

        return True, "ok"
    
    def update_domain(
            self,
            acc:    str,
            key:    str,
            domain: str,
            ip:     str
    ) -> tuple[bool, str]:
        filt, reason = self._filter_domain(domain)
        if not filt:
            return False, reason
        
        if not self._is_ip_valid(ip):
            return False, "invalid ip"

        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "not registered"
        
        if fsha256(key) != acc_data["keyhash"]:
            return False, "forbidden"

        if domain not in acc_data["domains"]:
            return False, "user does not have this domain"

        cost = self._calc_domain(domain) * self.domain_update_cf
        if acc_data["balance"] < cost:
            return False, f"cannot afford this cost: {cost:.3f}"
        
        acc_data["balance"] -= cost
        self.accs_db.set(acc, acc_data)
        self.domains_db.set(domain, ip)

        return True, "ok"

    def check_challange(
            self,
            acc:          str,
            key:          str,
            string2check: str
    ) -> tuple[bool, str]:
        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "not registered"
        
        if fsha256(key) != acc_data["keyhash"]:
            return False, "forbidden"
        
        print(f"[<] checking {string2check}")
        if not fsha256(f"{self.current_challange}{string2check}").startswith('0' * self.current_difficulty):
            return False, "not right"
        
        acc_data["balance"] += self.reward
        self.accs_db.set(acc, acc_data)

        self.new_challange()
        return True, "ok"

    def transac_fromto(
            self,
            acc: str,
            key: str,
            acc2: str,
            amount: float
    ) -> tuple[bool, str]:
        if amount <= 0:
            return False, "invalid amount"

        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "not registered"
        
        acc2_data = self.accs_db.get(acc)
        if acc2_data is None:
            return False, "other user does not exist"

        if fsha256(key) != acc_data["keyhash"]:
            return False, "forbidden"
        
        if acc_data["balance"] < amount:
            return False, f"cannot afford this amount: {amount}"

        acc_data["balance"] -= amount
        acc2_data["balance"] += amount
        self.accs_db.set(acc, acc_data)
        self.accs_db.set(acc2, acc2_data)
        self.turnover += abs(amount)
        return True, "ok"

    def acc_domains(
            self,
            acc: str
    ) -> tuple[bool, list[str] | str]:
        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "does not exists"

        return True, acc_data["domains"]

    def acc_balance(
            self,
            acc: str
    ) -> tuple[bool, float | str]:
        acc_data = self.accs_db.get(acc)
        if acc_data is None:
            return False, "does not exists"

        return True, acc_data["balance"]