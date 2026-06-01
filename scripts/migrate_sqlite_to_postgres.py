import sys
from sqlalchemy import create_engine, MetaData, Table, text
from sqlalchemy.orm import sessionmaker

SQLITE_URL = "sqlite:///./job_matching.db"
POSTGRES_URL = "postgresql://dinhkhaidang@localhost:5432/jobmatch"

def migrate():
    print("Connecting to databases...")
    sqlite_engine = create_engine(SQLITE_URL)
    postgres_engine = create_engine(POSTGRES_URL)
    
    sqlite_meta = MetaData()
    sqlite_meta.reflect(bind=sqlite_engine)
    
    postgres_meta = MetaData()
    postgres_meta.reflect(bind=postgres_engine)
    
    # We want to insert in topological order of foreign keys
    tables_in_order = [
        "users",
        "events",
        "email_verifications",
        "auth_tokens",
        "audit_logs",
        "candidate_profiles",
        "recruiter_profiles",
        "jobs",
        "applications",
        "interaction_logs",
        "recommendations",
        "notifications"
    ]
    
    # First, clear existing data in PostgreSQL in reverse order to avoid FK errors
    print("Clearing existing data in PostgreSQL...")
    with postgres_engine.begin() as conn:
        for table_name in reversed(tables_in_order):
            if table_name in postgres_meta.tables:
                conn.execute(text(f'TRUNCATE TABLE "{table_name}" CASCADE;'))
    
    print("Starting migration...")
    for table_name in tables_in_order:
        if table_name not in sqlite_meta.tables:
            print(f"Table '{table_name}' not found in SQLite. Skipping.")
            continue
            
        sqlite_table = Table(table_name, sqlite_meta, autoload_with=sqlite_engine)
        postgres_table = Table(table_name, postgres_meta, autoload_with=postgres_engine)
        
        # Get common columns between both tables
        sqlite_cols = set(sqlite_table.columns.keys())
        postgres_cols = set(postgres_table.columns.keys())
        common_cols = list(sqlite_cols.intersection(postgres_cols))
        
        print(f"Migrating table '{table_name}' (columns: {common_cols})...")
        
        # Read from SQLite
        with sqlite_engine.connect() as sqlite_conn:
            select_stmt = sqlite_table.select()
            rows = sqlite_conn.execute(select_stmt).fetchall()
            
        if not rows:
            print(f"No data to migrate for table '{table_name}'.")
            continue
            
        # Convert rows to dicts with only common columns
        records = []
        for row in rows:
            row_dict = dict(row._mapping)
            filtered_record = {k: row_dict[k] for k in common_cols}
            records.append(filtered_record)
            
        # Write to PostgreSQL
        with postgres_engine.begin() as postgres_conn:
            chunk_size = 500
            for i in range(0, len(records), chunk_size):
                chunk = records[i:i+chunk_size]
                postgres_conn.execute(postgres_table.insert(), chunk)
                
        print(f"Successfully migrated {len(records)} rows for table '{table_name}'.")

    print("\n✅ Migration from SQLite to PostgreSQL completed successfully!")

if __name__ == "__main__":
    migrate()
