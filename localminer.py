import hashlib, random, string, asyncio, aiohttp, json

def fsha256(inp) -> str:
    return hashlib.sha256(str(inp).encode()).hexdigest()

async def current_job(
        url: str
) -> dict | None:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"{url}/api/mining/job") as r:
            try:
                json = await r.json()
            except Exception as e:
                print(f"[!] server send malformed data, non-json: {e}")
                return None

            return {
                "job": json["challange"],
                "difficulty": json["difficulty"]
            }

async def checkfordone(
        url: str,
        job_info: dict,
        seconds_to_update: float = 5
):
    while True:
        job_data = await current_job(url)
        if job_data is None:
            await asyncio.sleep(seconds_to_update)
            continue

        async with job_info["lock"]:
            if job_info["current_job"] != job_data["job"]:
                print(f"[!] Job changed: {job_info['current_job']} -> {job_data['job']}")
                
                job_info["stop_event"].set()
                
                job_info["current_job"] = job_data["job"]
                job_info["difficulty"] = job_data["difficulty"]
                job_info["stop_event"] = asyncio.Event()

        await asyncio.sleep(seconds_to_update)

async def mine(
        preset: str,
        difficulty: int,
        stop_event: asyncio.Event,
        l: int = 20
) -> str:
    
    print(f"[>] mining with preset: {preset}")
    while not stop_event.is_set():
        s = ''.join(random.choices(string.ascii_letters + string.digits, k=l))
        if fsha256(preset + s).startswith('0' * difficulty):
            return s
        await asyncio.sleep(0)
    raise asyncio.CancelledError("Job changed")

async def submit(
        account: str,
        key: str,
        mined: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/mining/check", json={"account": account, "key": key, "string": mined}) as r:
            return (await r.json()).get("description", "")

async def balance(
        account: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/acc/balance", json={"account": account}) as r:
            return (await r.json()).get("description", "N/A")

async def registrate(
        key: str,
        url: str
) -> str:
    async with aiohttp.ClientSession() as s:
        async with s.post(f"{url}/api/acc/new", json={"key": key}) as r:  # Исправлено на POST
            return (await r.json()).get("description", "")

async def main():
    base_url = "http://127.0.0.1:9001"#89.19.215.10
    
    # Генерация ключа и регистрация
    key = ''.join(random.choices(string.ascii_letters + string.digits, k=30))
    account = await registrate(key, base_url)
    print(f"[+] Registered account: {account}, key: {key[:5]}...")

    with open("./.account", 'w') as f:
        json.dump({"acc": account, "key": key}, f)

    # Общее состояние для синхронизации
    job_info = {
        "current_job": None,
        "difficulty": None,
        "stop_event": asyncio.Event(),
        "lock": asyncio.Lock()
    }

    # Получаем первое задание
    first_job = await current_job(base_url)
    if not first_job:
        print("[!] failed to get initial job")
        return
    
    async with job_info["lock"]:
        job_info["current_job"] = first_job["job"]
        job_info["difficulty"] = first_job["difficulty"]

    # Запускаем фоновую проверку заданий
    check_task = asyncio.create_task(
        checkfordone(base_url, job_info, seconds_to_update=3)
    )

    n = 0
    try:
        while True:
            if n % 5 == 0:
                bal = await balance(account, base_url)
                print(f"[{n}ts] current balance: {bal}")

            async with job_info["lock"]:
                curr_job = job_info["current_job"]
                difficulty = job_info["difficulty"]
                stop_event = job_info["stop_event"]

            try:
                mined = await mine(curr_job, difficulty, stop_event)
                result = await submit(account, key, mined, base_url)
                print(f"[+] mined '{mined}' | {result}")

                njob = await current_job(base_url)
                if not njob:
                    print(f"[*] failed to get a new job")
                    break

                async with job_info["lock"]:
                    job_info["current_job"] = njob["job"]
                    job_info["difficulty"] = njob["difficulty"]

            except asyncio.CancelledError:
                print("[-] mining interrupted: job changed")
                continue
            except Exception as e:
                print(f"[-] error during mining: {str(e)}")
                await asyncio.sleep(1)

            n += 1
    finally:
        check_task.cancel()
        await check_task

if __name__ == "__main__":
    asyncio.run(main())
