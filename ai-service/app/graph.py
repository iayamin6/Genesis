from langgraph.graph import StateGraph, START, END
from .agents import GraphState, market, risk, legal, competitive, assumptions, financial, pitch

def build_graph():
    graph = StateGraph(GraphState)
    for name, node in [("market", market), ("risk", risk), ("legal", legal), ("competitive", competitive), ("assumptions", assumptions), ("financial", financial), ("pitch", pitch)]: graph.add_node(name, node)
    # LangGraph fans these branches out concurrently. Financial waits for market; pitch waits for every input.
    graph.add_edge(START, "market"); graph.add_edge(START, "risk"); graph.add_edge(START, "legal"); graph.add_edge(START, "competitive"); graph.add_edge(START, "assumptions")
    graph.add_edge("market", "financial")
    graph.add_edge(["risk", "legal", "competitive", "assumptions", "financial"], "pitch")
    graph.add_edge("pitch", END)
    return graph.compile()
