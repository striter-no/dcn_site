import asyncio, aiohttp, json

async def stats(
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{url}/api/stats") as r:
            return (await r.json())

async def balance(
        account: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/acc/balance", json={"account": account}) as r:
            return (await r.json()).get("description", "N/A")

async def domains(
        account: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/acc/domains", json={"account": account}) as r:
            return (await r.json()).get("description", "N/A")

async def transfer(
        account: str,
        key: str,
        account_to: str,
        amount: float,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/trnsc/transfer", json={
            "account": account, 
            "key": key, 
            "account_to": account_to, 
            "amount": amount
        }) as r:
            return (await r.json()).get("description", "N/A")

async def new_domain(
        account: str,
        key: str,
        domain: str,
        ip: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/trnsc/new_domain", json={
            "account": account, 
            "key": key, 
            "domain": domain, 
            "ip": ip
        }) as r:
            return (await r.json()).get("description", "N/A")
        
async def update_domain(
        account: str,
        key: str,
        domain: str,
        ip: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/trnsc/update_domain", json={
            "account": account, 
            "key": key, 
            "domain": domain, 
            "ip": ip
        }) as r:
            return (await r.json()).get("description", "N/A")

async def main():
    print("DCN client\nbal [acc_addr] - get balance\nstats - get stats about DCN\nndom domain ip - register new domain\nudom domain ip - update existing domain\ntrn to amount - transfer AMOUNT amount of balance to the TO address")
    print("-"*10 + "\n")
    
    base_url = "http://89.19.215.10"#
    
    acc_data = json.load(open("./.account"))
    account, key = acc_data["acc"], acc_data["key"]

    while True:
        queue = input("> ").split()
        match queue[0]:
            case "exit": break
            case "bal":
                address = account if len(queue) == 1 else queue[1]
                print(await balance(address, base_url))
            case "stats":
                print(await stats(base_url))
            case "ndom":
                print(await new_domain(account, key, queue[1], queue[2], base_url))
            case "udom":
                print(await update_domain(account, key, queue[1], queue[2], base_url))
            case "trn":
                print(await transfer(account, key, queue[1], float(queue[2]), base_url))

if __name__ == "__main__":
    asyncio.run(main())