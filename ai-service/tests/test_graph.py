import pytest
from app.graph import build_graph

def test_dependency_graph_requires_market_before_financial_and_all_inputs_before_pitch():
    graph = build_graph().get_graph()
    edges = {(edge.source, edge.target) for edge in graph.edges}
    assert ('market', 'financial') in edges
    for source in ('risk', 'legal', 'competitive', 'assumptions', 'financial'):
        assert (source, 'pitch') in edges

def test_graph_exposes_all_seven_agents():
    names = set(build_graph().get_graph().nodes)
    assert {'market', 'risk', 'legal', 'competitive', 'assumptions', 'financial', 'pitch'} <= names
