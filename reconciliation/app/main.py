"""
Strawberry ASGI app with GraphQL endpoint.
"""

import os
from strawberry.asgi import GraphQL
from app.schema import schema
from starlette.applications import Starlette

app = GraphQL(schema)


app = Starlette()

graphql_app = GraphQL(schema)

app.mount("/graphql", graphql_app)

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run(app, host=host, port=port)
