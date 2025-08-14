import os
from operator import itemgetter
from typing_extensions import TypedDict

from dotenv import load_dotenv, find_dotenv
from langchain_community.vectorstores.pgvector import PGVector
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
# from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_core.runnables import RunnableParallel

_ = load_dotenv(find_dotenv())

os.environ['OPENAI_API_KEY'] = os.environ['OPENROUTER_API_KEY']

class RagInput(TypedDict):
    question: str

required_env_vars = ['PGVECTOR_CONNECTION_STRING']
missing_vars = [var for var in required_env_vars if not os.getenv(var)]
if missing_vars:
    print(f"Missing required env vars: {missing_vars}")
else:
    try:
        conn_str = os.environ['PGVECTOR_CONNECTION_STRING']
        embeddings = HuggingFaceEmbeddings(model_name="intfloat/e5-small-v2", cache_folder="./models")

        vector_store = PGVector(
            collection_name="collection164",
            connection_string=conn_str,
            embedding_function=embeddings,
            use_jsonb=True
        )

        prompt_template = """
        Answer the question using only the context below:

        {context}

        Question: {question}
        """

        prompt = ChatPromptTemplate.from_template(prompt_template)

        llm = ChatOpenAI(
            temperature=0,
            # model="gpt-4-1106-preview",
            model = 'gpt-3.5-turbo',
            streaming=True
        )

        # llm = ChatAnthropic(
        #    model="claude-3-haiku-20240307",  
        #    temperature=0,
        #    streaming=True
        #)

        final_chain = (
            RunnableParallel(
                context=(itemgetter("question") | vector_store.as_retriever()),
                question=itemgetter("question")
            )
            | RunnableParallel(
                answer=(prompt | llm),
                docs=itemgetter("context")
            )
        ).with_types(input_type=RagInput)

    except Exception as e:
        print(f"Initialization failed: {e}")
