import asyncio
import asyncpg
import sys

async def main():
    db_url = sys.argv[1].replace("postgresql://", "postgres://", 1)
    conn = await asyncpg.connect(db_url, ssl="require")
    
    # 1. List all databases
    databases = await conn.fetch("SELECT datname FROM pg_database WHERE datistemplate = false;")
    print("=== DATABASES ===")
    for d in databases:
        print(f"Db: {d['datname']}")
        
    # 2. List all tables across schemas
    tables = await conn.fetch("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema');
    """)
    print("\n=== SYSTEM / ALL SCHEMAS TABLES ===")
    for t in tables:
        print(f"Table: {t['table_schema']}.{t['table_name']}")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
