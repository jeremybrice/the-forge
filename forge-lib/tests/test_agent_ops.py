"""Tests for agent operations (rovo-forge integration)."""
import json
import os
import pytest
from pathlib import Path
from unittest.mock import patch
from datetime import date


@pytest.fixture
def temp_dir(tmp_path):
    """Create a temporary directory for tests."""
    return tmp_path


@pytest.fixture
def agent_dir(temp_dir):
    """Create and return the rovo-agents directory."""
    d = temp_dir / 'rovo-agents'
    d.mkdir()
    return d


class TestCreateAgent:
    """Tests for create_agent function."""

    def test_create_jira_agent(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Ticket Triage Agent',
            'platform': 'jira',
            'description': 'Triages incoming Jira tickets based on priority and team routing rules.',
            'skills': ['Search Jira Issues (JQL)', 'Update Issue Fields'],
            'knowledge_sources': ['SUPPORT project'],
            'conversation_starters': ['Triage new tickets', 'Show untriaged issues', 'Route this ticket'],
            'owner': 'Jeremy Brice',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['filename'] == 'agent.md'
        assert result['slug'] == 'ticket-triage-agent'
        assert result['dirpath'] == str(temp_dir / 'rovo-agents' / 'ticket-triage-agent')
        assert (temp_dir / 'rovo-agents' / 'ticket-triage-agent' / 'agent.md').exists()

    def test_create_confluence_agent(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Documentation Specialist',
            'platform': 'confluence',
            'description': 'Creates and maintains technical documentation in Confluence spaces.',
            'skills': ['Create Confluence Page', 'Update Confluence Page Content'],
            'knowledge_sources': ['Engineering space'],
            'conversation_starters': ['Create new docs', 'Review this page', 'Update the runbook'],
            'owner': 'Jeremy Brice',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['slug'] == 'documentation-specialist'
        assert 'platform: confluence' in (temp_dir / 'rovo-agents' / 'documentation-specialist' / 'agent.md').read_text()

    def test_create_agent_validates_against_schema(self, temp_dir):
        from core.agent_ops import create_agent
        from core.validator import ValidationError
        data = {
            'name': 'X',  # Too short (schema should require minLength)
            'platform': 'invalid',
        }
        with pytest.raises((ValidationError, Exception)):
            create_agent(data, directory=str(temp_dir))

    def test_create_agent_generates_slug(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Ticket Generation and Triage Agent',
            'platform': 'jira',
            'description': 'Generates and triages tickets for the support team.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Generate tickets', 'Triage queue', 'Show stats'],
            'owner': 'Test User',
            'collaborators': [],
            'visibility': 'organization',
        }
        result = create_agent(data, directory=str(temp_dir))
        assert result['slug'] == 'ticket-generation-and-triage-agent'

    def test_create_agent_updates_index(self, temp_dir):
        from core.agent_ops import create_agent
        data = {
            'name': 'Test Agent',
            'platform': 'jira',
            'description': 'A test agent for verifying index updates work correctly.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Test me', 'Run check', 'Show status'],
            'owner': 'Test User',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        index_path = temp_dir / 'rovo-agents' / 'index.json'
        assert index_path.exists()
        index_data = json.loads(index_path.read_text())
        assert len(index_data['entries']) == 1
        assert index_data['entries'][0]['name'] == 'Test Agent'

    def test_create_duplicate_agent_raises(self, temp_dir):
        from core.agent_ops import create_agent, AgentError
        data = {
            'name': 'Duplicate Agent',
            'platform': 'jira',
            'description': 'This agent tests that duplicates are properly rejected.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Test', 'Check', 'Run'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        with pytest.raises(AgentError):
            create_agent(data, directory=str(temp_dir))


class TestGetAgent:
    """Tests for get_agent function."""

    def test_get_existing_agent(self, temp_dir):
        from core.agent_ops import create_agent, get_agent
        data = {
            'name': 'Fetchable Agent',
            'platform': 'jira',
            'description': 'An agent that can be fetched after creation for testing.',
            'skills': ['Search Jira Issues (JQL)'],
            'knowledge_sources': [],
            'conversation_starters': ['Fetch me', 'Get info', 'Show details'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }
        create_agent(data, directory=str(temp_dir))
        result = get_agent('fetchable-agent', directory=str(temp_dir))
        assert result['name'] == 'Fetchable Agent'
        assert result['platform'] == 'jira'

    def test_get_nonexistent_agent_raises(self, temp_dir):
        from core.agent_ops import get_agent, AgentError
        with pytest.raises(AgentError):
            get_agent('nonexistent-agent', directory=str(temp_dir))


class TestQueryAgents:
    """Tests for query_agents function."""

    def test_query_all_agents(self, temp_dir):
        from core.agent_ops import create_agent, query_agents
        for name, platform in [('Agent A', 'jira'), ('Agent B', 'confluence'), ('Agent C', 'jira')]:
            create_agent({
                'name': name,
                'platform': platform,
                'description': f'Test agent {name} for query testing across platforms.',
                'skills': [],
                'knowledge_sources': [],
                'conversation_starters': ['Start', 'Go', 'Run'],
                'owner': 'Test',
                'collaborators': [],
                'visibility': 'organization',
            }, directory=str(temp_dir))
        results = query_agents(directory=str(temp_dir))
        assert len(results) == 3

    def test_query_by_platform(self, temp_dir):
        from core.agent_ops import create_agent, query_agents
        for name, platform in [('Jira Agent', 'jira'), ('Confluence Agent', 'confluence')]:
            create_agent({
                'name': name,
                'platform': platform,
                'description': f'Test {platform} agent for platform filtering tests.',
                'skills': [],
                'knowledge_sources': [],
                'conversation_starters': ['Start', 'Go', 'Run'],
                'owner': 'Test',
                'collaborators': [],
                'visibility': 'organization',
            }, directory=str(temp_dir))
        results = query_agents(directory=str(temp_dir), filters={'platform': 'jira'})
        assert len(results) == 1
        assert results[0]['name'] == 'Jira Agent'


class TestUpdateAgent:
    """Tests for update_agent function."""

    def test_update_agent_status(self, temp_dir):
        from core.agent_ops import create_agent, update_agent
        create_agent({
            'name': 'Updatable Agent',
            'platform': 'jira',
            'description': 'An agent that will be updated to test status changes.',
            'skills': [],
            'knowledge_sources': [],
            'conversation_starters': ['Start', 'Go', 'Run'],
            'owner': 'Test',
            'collaborators': [],
            'visibility': 'organization',
        }, directory=str(temp_dir))
        result = update_agent('updatable-agent', {'status': 'published'}, directory=str(temp_dir))
        assert result['status'] == 'published'
