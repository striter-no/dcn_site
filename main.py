import re, asyncio

from flask import Flask, render_template, request, jsonify
from system.mineserver import *
from system.dnsupdate import *

app = Flask(
    __name__, 
    static_folder = "./resources/static",
    template_folder = "./resources/templates"
)

mnserv = Server()
domain_lock = asyncio.Lock()

@app.route("/")
async def index():
    return render_template("index.html")

@app.route("/domains.html")
async def domains():
    return render_template("domains.html")

@app.route("/pre-register.html")
async def pre_register():
    return render_template("pre-register.html")

@app.route("/registration.html")
async def registration():
    return render_template("registration.html")

@app.route("/mining.html")
async def mining():
    return render_template("mining.html")

# ============================= MINING =============================
@app.route("/api/mining/job", methods=["GET"])
async def mining_get():
    # print(f"[*] get job")
    return jsonify({
        "challange": mnserv.current_challange,
        "difficulty": mnserv.current_difficulty,
        "status": "ok"
    })

@app.route("/api/mining/check", methods=["POST"])
async def mining_check():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")
    key     = content.get("key")
    cstring = content.get("string")

    if account is None:
        print(f"[!] mining check: account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    if key is None:
        print(f"[!] mining check (from {account[:20]}): key is None")
        return jsonify({
            "description": "key param is not defined",
            "status": "fail"
        })

    if cstring is None:
        print(f"[!] mining check (from {account[:20]}): string is None")
        return jsonify({
            "description": "string param is not defined",
            "status": "fail"
        })
    
    status, descr = mnserv.check_challange(account, key, cstring)
    
    print(f"[+] mining (from {account[:20]}): {descr}")
    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

# ============================= TRANSACTIONS =============================
@app.route("/api/trnsc/new_domain", methods=["POST"])
async def trnsc_newdomain():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")
    key     = content.get("key")
    domain  = content.get("domain")
    ip      = content.get("ip")

    if account is None:
        print(f"[!] new domain: account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    if key is None:
        print(f"[!] new domain (from {account[:20]}): key is None")
        return jsonify({
            "description": "key param is not defined",
            "status": "fail"
        })

    if domain is None:
        print(f"[!] new domain (from {account[:20]}): domain is None")
        return jsonify({
            "description": "domain param is not defined",
            "status": "fail"
        })
    
    if ip is None:
        print(f"[!] new domain (from {account[:20]}): ip is None")
        return jsonify({
            "description": "ip param is not defined",
            "status": "fail"
        })
    
    status, descr = mnserv.new_domain(account, key, domain, ip)
    print(f"[+] new domain (from {account[:20]}): {descr}")

    if status:
        async with domain_lock:
            reg_new_domain(domain, ip)
            reload_domains()

    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

@app.route("/api/trnsc/update_domain", methods=["POST"])
async def trnsc_upddomain():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")
    key     = content.get("key")
    domain  = content.get("domain")
    ip      = content.get("ip")

    if account is None:
        print(f"[!] update domain account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    if key is None:
        print(f"[!] update domain (from {account[:20]}): key is None")
        return jsonify({
            "description": "key param is not defined",
            "status": "fail"
        })

    if domain is None:
        print(f"[!] update domain (from {account[:20]}): domain is None")
        return jsonify({
            "description": "domain param is not defined",
            "status": "fail"
        })
    
    if ip is None:
        print(f"[!] update domain (from {account[:20]}): ip is None")
        return jsonify({
            "description": "ip param is not defined",
            "status": "fail"
        })
    
    status, descr = mnserv.update_domain(account, key, domain, ip)
    print(f"[+] update domain (from {account[:20]}): {descr}")

    if status:
        async with domain_lock:
            del_domain(domain)
            reg_new_domain(domain, ip)
            reload_domains()

    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

@app.route("/api/trnsc/transfer", methods=["POST"])
async def trnsc_fromto():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")
    key     = content.get("key")
    account_to  = content.get("account_to")
    amount      = content.get("amount")

    if account is None:
        print(f"[!] transfer account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    if key is None:
        print(f"[!] transfer (from {account[:20]}): key is None")
        return jsonify({
            "description": "key param is not defined",
            "status": "fail"
        })

    if account_to is None:
        print(f"[!] transfer (from {account[:20]}): account_to is None")
        return jsonify({
            "description": "account_to param is not defined",
            "status": "fail"
        })
    
    if amount is None:
        print(f"[!] transfer (from {account[:20]}): amount is None")
        return jsonify({
            "description": "amount param is not defined",
            "status": "fail"
        })

    pattern = r"^-?\d+\.\d+$"  # Regular expression for a valid float
    if not re.match(pattern, amount):
        print(f"[!] transfer (from {account[:20]}): amount is not a valid float")
        return jsonify({
            "description": "amount param must be a valid float",
            "status": "fail"
        })
    
    status, descr = mnserv.transac_fromto(account, key, account_to, float(amount))
    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

# ============================= ACCOUNTS =============================
@app.route("/api/acc/domains", methods=["POST"])
async def acc_domains():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")

    if account is None:
        print(f"[!] acc_domains account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    status, descr = mnserv.acc_domains(account)
    print(f"[+] acc domains (from {account[:20]}): {descr}")
    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

@app.route("/api/acc/balance", methods=["POST"])
async def acc_balance():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    account = content.get("account")

    if account is None:
        print(f"[!] acc_balance account is None")
        return jsonify({
            "description": "account param is not defined",
            "status": "fail"
        })
    
    status, descr = mnserv.acc_balance(account)
    print(f"[+] acc balance (from {account[:20]}): {descr}")
    return jsonify({
        "description": descr,
        "status": "ok" if status else "error"
    })

@app.route("/api/acc/new", methods=["POST"])
async def acc_new():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    key = content.get("key")

    if key is None:
        print(f"[!] new account key is None")
        return jsonify({
            "description": "key param is not defined",
            "status": "fail"
        })
    
    acc = mnserv.new_acc(key)
    return jsonify({
        "description": acc,
        "status": "ok"
    })

# ============================= STATISTICS =============================
@app.route("/api/stats", methods=["GET"])
def statistics():
    return jsonify({
        "domains": len(get_loaded_domains()),
        "holders": len(mnserv.accs_db.all()),
        "turnover": mnserv.turnover
    })

@app.route("/api/dmn/cost", methods=["POST"])
def dmn_cost():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    domain = content.get("domain")

    if domain is None:
        print(f"[!] domain cost: domain is None")
        return jsonify({
            "description": "domain param is not defined",
            "status": "fail"
        })
    
    cost = mnserv._calc_domain(domain)
    return jsonify({
        "description": cost,
        "status": "ok"
    })

@app.route("/api/dmn/owner", methods=["POST"])
def dmn_owner():
    if not request.is_json:
        return "invalid usage, please provide json data"

    content = request.get_json(silent=True)
    domain = content.get("domain")

    if domain is None:
        print(f"[!] domain owner: domain is None")
        return jsonify({
            "description": "domain param is not defined",
            "status": "fail"
        })
    
    for acc in mnserv.accs_db.all():
        acc_data = mnserv.accs_db.get(acc)
        if domain in acc_data["domains"]:
            return jsonify({
                "description": acc,
                "status": "ok"
            })

    return jsonify({
        "description": "noone",
        "status": "ok"
    })

if __name__ == "__main__":
    mnserv.new_challange()

    app.run(
        host = "192.168.1.4", 
        port =  9001,
        debug = True
    )
