import os
from dotenv import load_dotenv, find_dotenv
from langchain_community.document_loaders import DirectoryLoader, UnstructuredPDFLoader
from langchain_community.vectorstores.pgvector import PGVector
from langchain_experimental.text_splitter import SemanticChunker
# from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings

os.environ['OPENAI_API_KEY'] = os.environ['OPENROUTER_API_KEY']

def main():
    _ = load_dotenv(find_dotenv())

    # Validate required env vars
    required_env_vars = ['PGVECTOR_CONNECTION_STRING']
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        print(f"Missing environment variables: {missing_vars}")
        return

    pdf_dir = os.path.abspath("../pdf-documents")
    if not os.path.exists(pdf_dir):
        raise FileNotFoundError(f"Directory not found: {pdf_dir}")

    print(f"Loading PDFs from: {pdf_dir}")
    loader = DirectoryLoader(
        pdf_dir,
        glob="**/*.pdf",
        use_multithreading=True,
        show_progress=True,
        max_concurrency=50,
        loader_cls=UnstructuredPDFLoader,
    )

    try:
        docs = loader.load()
        if not docs:
            print("No documents found.")
            return
        print(f"Successfully loaded {len(docs)} documents")
    except Exception as e:
        print(f"Error loading documents: {e}")
        return

    # Initialize local embeddings
    try:
        embeddings = HuggingFaceEmbeddings(
            model_name="intfloat/e5-small-v2",
            cache_folder="./models"
        )
    except Exception as e:
        print(f"Failed to load local embedding model: {e}")
        return

    print("Splitting documents into semantic chunks...")
    splitter = SemanticChunker(
        embeddings=embeddings,
        breakpoint_threshold_type="percentile"
    )

    try:
        valid_docs = [doc for doc in docs if doc]
        if not valid_docs:
            print("No valid documents found.")
            return

        chunks = splitter.split_documents(valid_docs)
        print(f"Created {len(chunks)} chunks")
    except Exception as e:
        print(f"Error splitting documents: {e}")
        return

    conn_str = os.environ["PGVECTOR_CONNECTION_STRING"]
    print("Storing chunks in PGVector database...")
    try:
        PGVector.from_documents(
            documents=chunks,
            embedding=embeddings,
            collection_name="collection164",
            connection_string=conn_str,
            pre_delete_collection=True,
            use_jsonb=True,
        )
        print(f"Successfully stored {len(chunks)} chunks")
    except Exception as e:
        print(f"Error storing chunks: {e}")


if __name__ == "__main__":
    main()
