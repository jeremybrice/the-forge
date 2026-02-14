"""
Tests for memory_ops module.
"""

import pytest
import tempfile
import shutil
from pathlib import Path
from core import memory_ops
from core.memory_ops import MemoryError


@pytest.fixture
def temp_dir():
    """Create a temporary directory for tests"""
    temp = tempfile.mkdtemp()
    yield temp
    shutil.rmtree(temp)


@pytest.fixture
def memory_dir(temp_dir):
    """Create memory directory structure"""
    result = memory_ops.init_memory(directory=temp_dir)
    return temp_dir


class TestInitMemory:
    def test_init_creates_directory_structure(self, temp_dir):
        """Test that init creates memory/context/ directory"""
        result = memory_ops.init_memory(directory=temp_dir)

        assert result["success"] is True
        assert Path(temp_dir, "memory", "context").exists()

    def test_init_creates_stub_files(self, temp_dir):
        """Test that init creates all stub files"""
        result = memory_ops.init_memory(directory=temp_dir)

        context_dir = Path(temp_dir, "memory", "context")
        assert (context_dir / "products.md").exists()
        assert (context_dir / "clients.md").exists()
        assert (context_dir / "integrations.md").exists()
        assert (context_dir / "company.md").exists()

    def test_init_files_have_frontmatter(self, temp_dir):
        """Test that stub files contain YAML frontmatter"""
        memory_ops.init_memory(directory=temp_dir)

        products_file = Path(temp_dir, "memory", "context", "products.md")
        content = products_file.read_text()

        assert "---\n" in content
        assert "products: []" in content
        assert "modules: []" in content
        assert "systems: []" in content

    def test_init_is_idempotent(self, temp_dir):
        """Test that running init multiple times doesn't overwrite existing files"""
        # First init
        result1 = memory_ops.init_memory(directory=temp_dir)
        assert len(result1["created_files"]) == 4

        # Modify a file
        products_file = Path(temp_dir, "memory", "context", "products.md")
        original_content = products_file.read_text()
        products_file.write_text("Modified content\n")

        # Second init
        result2 = memory_ops.init_memory(directory=temp_dir)
        assert len(result2["created_files"]) == 0  # No files created

        # File should still be modified
        assert products_file.read_text() == "Modified content\n"


class TestGetTaxonomy:
    def test_get_taxonomy_products_empty(self, memory_dir):
        """Test getting empty products taxonomy"""
        values = memory_ops.get_taxonomy("products", memory_dir)
        assert values == []

    def test_get_taxonomy_returns_empty_for_nonexistent_file(self, temp_dir):
        """Test getting taxonomy from nonexistent file returns empty list"""
        values = memory_ops.get_taxonomy("products", temp_dir)
        assert values == []

    def test_get_taxonomy_multiple_types_from_same_file(self, memory_dir):
        """Test that products, modules, systems all read from same file"""
        # Add values to products.md
        file_path = Path(memory_dir, "memory", "context", "products.md")
        content = file_path.read_text()
        # Replace empty arrays
        content = content.replace(
            "products: []",
            "products:\n  - ProductA\n  - ProductB"
        )
        content = content.replace(
            "modules: []",
            "modules:\n  - ModuleX\n  - ModuleY"
        )
        content = content.replace(
            "systems: []",
            "systems:\n  - SystemOne\n  - SystemTwo"
        )
        file_path.write_text(content)

        # Get each taxonomy type
        products = memory_ops.get_taxonomy("products", memory_dir)
        modules = memory_ops.get_taxonomy("modules", memory_dir)
        systems = memory_ops.get_taxonomy("systems", memory_dir)

        assert products == ["ProductA", "ProductB"]
        assert modules == ["ModuleX", "ModuleY"]
        assert systems == ["SystemOne", "SystemTwo"]

    def test_get_taxonomy_clients(self, memory_dir):
        """Test getting clients taxonomy"""
        # Add clients
        file_path = Path(memory_dir, "memory", "context", "clients.md")
        content = file_path.read_text()
        content = content.replace(
            "clients: []",
            "clients:\n  - ClientA\n  - ClientB"
        )
        file_path.write_text(content)

        values = memory_ops.get_taxonomy("clients", memory_dir)
        assert values == ["ClientA", "ClientB"]

    def test_get_taxonomy_teams(self, memory_dir):
        """Test getting teams taxonomy from company.md"""
        # Add teams
        file_path = Path(memory_dir, "memory", "context", "company.md")
        content = file_path.read_text()
        content = content.replace(
            "teams: []",
            "teams:\n  - Engineering\n  - Sales"
        )
        file_path.write_text(content)

        values = memory_ops.get_taxonomy("teams", memory_dir)
        assert values == ["Engineering", "Sales"]

    def test_get_taxonomy_unsupported_type(self, memory_dir):
        """Test that unsupported taxonomy type raises error"""
        with pytest.raises(MemoryError) as exc_info:
            memory_ops.get_taxonomy("invalid_type", memory_dir)

        assert "Unsupported taxonomy type" in str(exc_info.value)

    def test_get_taxonomy_malformed_yaml_key(self, memory_dir):
        """Test that non-list YAML value raises error"""
        file_path = Path(memory_dir, "memory", "context", "products.md")
        content = file_path.read_text()
        content = content.replace("products: []", "products: not_a_list")
        file_path.write_text(content)

        with pytest.raises(MemoryError) as exc_info:
            memory_ops.get_taxonomy("products", memory_dir)

        assert "is not a list" in str(exc_info.value)


class TestSetTaxonomy:
    def test_set_taxonomy_add_to_empty(self, memory_dir):
        """Test adding value to empty taxonomy"""
        result = memory_ops.set_taxonomy(
            "products",
            "NewProduct",
            operation="add",
            directory=memory_dir
        )

        assert result["success"] is True
        assert result["action"] == "added"
        assert result["value"] == "NewProduct"
        assert "NewProduct" in result["values"]

        # Verify it was written
        values = memory_ops.get_taxonomy("products", memory_dir)
        assert values == ["NewProduct"]

    def test_set_taxonomy_add_multiple_values(self, memory_dir):
        """Test adding multiple values"""
        memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)
        memory_ops.set_taxonomy("products", "ProductB", "add", memory_dir)
        memory_ops.set_taxonomy("products", "ProductC", "add", memory_dir)

        values = memory_ops.get_taxonomy("products", memory_dir)
        assert values == ["ProductA", "ProductB", "ProductC"]

    def test_set_taxonomy_add_duplicate(self, memory_dir):
        """Test adding duplicate value doesn't create duplicate"""
        memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)
        result = memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)

        assert result["action"] == "already exists"
        values = memory_ops.get_taxonomy("products", memory_dir)
        assert values == ["ProductA"]  # Only one entry

    def test_set_taxonomy_remove_value(self, memory_dir):
        """Test removing a value"""
        # Add values
        memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)
        memory_ops.set_taxonomy("products", "ProductB", "add", memory_dir)

        # Remove one
        result = memory_ops.set_taxonomy("products", "ProductA", "remove", memory_dir)

        assert result["success"] is True
        assert result["action"] == "removed"
        assert result["value"] == "ProductA"

        values = memory_ops.get_taxonomy("products", memory_dir)
        assert values == ["ProductB"]

    def test_set_taxonomy_remove_nonexistent(self, memory_dir):
        """Test removing nonexistent value"""
        result = memory_ops.set_taxonomy("products", "NonExistent", "remove", memory_dir)

        assert result["action"] == "not found"

    def test_set_taxonomy_creates_file_if_missing(self, temp_dir):
        """Test that set_taxonomy creates file if it doesn't exist"""
        # Don't initialize memory structure
        result = memory_ops.set_taxonomy("products", "ProductA", "add", temp_dir)

        assert result["success"] is True
        file_path = Path(temp_dir, "memory", "context", "products.md")
        assert file_path.exists()

        values = memory_ops.get_taxonomy("products", temp_dir)
        assert values == ["ProductA"]

    def test_set_taxonomy_modules_and_systems(self, memory_dir):
        """Test setting modules and systems (same file as products)"""
        memory_ops.set_taxonomy("modules", "ModuleA", "add", memory_dir)
        memory_ops.set_taxonomy("systems", "SystemA", "add", memory_dir)

        modules = memory_ops.get_taxonomy("modules", memory_dir)
        systems = memory_ops.get_taxonomy("systems", memory_dir)

        assert modules == ["ModuleA"]
        assert systems == ["SystemA"]

    def test_set_taxonomy_clients(self, memory_dir):
        """Test setting clients taxonomy"""
        memory_ops.set_taxonomy("clients", "ClientA", "add", memory_dir)
        values = memory_ops.get_taxonomy("clients", memory_dir)
        assert values == ["ClientA"]

    def test_set_taxonomy_teams(self, memory_dir):
        """Test setting teams taxonomy (company.md)"""
        memory_ops.set_taxonomy("teams", "Engineering", "add", memory_dir)
        values = memory_ops.get_taxonomy("teams", memory_dir)
        assert values == ["Engineering"]

    def test_set_taxonomy_invalid_operation(self, memory_dir):
        """Test that invalid operation raises error"""
        with pytest.raises(MemoryError) as exc_info:
            memory_ops.set_taxonomy("products", "ProductA", "invalid", memory_dir)

        assert "Invalid operation" in str(exc_info.value)

    def test_set_taxonomy_preserves_body_content(self, memory_dir):
        """Test that set_taxonomy preserves markdown body"""
        # Add custom content to body
        file_path = Path(memory_dir, "memory", "context", "products.md")
        content = file_path.read_text()
        content += "\n## Custom Section\n\nCustom content here.\n"
        file_path.write_text(content)

        # Modify taxonomy
        memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)

        # Check body is preserved
        new_content = file_path.read_text()
        assert "## Custom Section" in new_content
        assert "Custom content here" in new_content


class TestGetTaxonomyFilePath:
    def test_get_taxonomy_file_path_products(self, temp_dir):
        """Test getting file path for products"""
        path = memory_ops.get_taxonomy_file_path("products", temp_dir)
        assert str(path) == str(Path(temp_dir) / "memory/context/products.md")

    def test_get_taxonomy_file_path_modules_same_as_products(self, temp_dir):
        """Test that modules and products use same file"""
        products_path = memory_ops.get_taxonomy_file_path("products", temp_dir)
        modules_path = memory_ops.get_taxonomy_file_path("modules", temp_dir)
        assert products_path == modules_path

    def test_get_taxonomy_file_path_clients(self, temp_dir):
        """Test getting file path for clients"""
        path = memory_ops.get_taxonomy_file_path("clients", temp_dir)
        assert str(path) == str(Path(temp_dir) / "memory/context/clients.md")

    def test_get_taxonomy_file_path_teams(self, temp_dir):
        """Test getting file path for teams (company.md)"""
        path = memory_ops.get_taxonomy_file_path("teams", temp_dir)
        assert str(path) == str(Path(temp_dir) / "memory/context/company.md")

    def test_get_taxonomy_file_path_invalid_type(self, temp_dir):
        """Test that invalid type raises error"""
        with pytest.raises(MemoryError) as exc_info:
            memory_ops.get_taxonomy_file_path("invalid", temp_dir)

        assert "Unsupported taxonomy type" in str(exc_info.value)


class TestGetTaxonomyJson:
    def test_get_taxonomy_json_success(self, memory_dir):
        """Test JSON output for successful get_taxonomy"""
        memory_ops.set_taxonomy("products", "ProductA", "add", memory_dir)

        json_output = memory_ops.get_taxonomy_json("products", memory_dir)

        import json
        data = json.loads(json_output)

        assert data["success"] is True
        assert data["taxonomy_type"] == "products"
        assert data["values"] == ["ProductA"]

    def test_get_taxonomy_json_error(self, memory_dir):
        """Test JSON output for error"""
        json_output = memory_ops.get_taxonomy_json("invalid_type", memory_dir)

        import json
        data = json.loads(json_output)

        assert data["success"] is False
        assert "error" in data
        assert data["taxonomy_type"] == "invalid_type"
