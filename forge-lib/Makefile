# Makefile for forge-lib development and testing

.PHONY: help test test-unit test-integration test-coverage test-watch clean install lint format check

# Default target
help:
	@echo "Available targets:"
	@echo "  make test              - Run all tests"
	@echo "  make test-unit         - Run unit tests only"
	@echo "  make test-integration  - Run integration tests only"
	@echo "  make test-coverage     - Run tests with coverage report"
	@echo "  make test-watch        - Run tests in watch mode"
	@echo "  make clean             - Remove generated files"
	@echo "  make install           - Install dependencies"
	@echo "  make lint              - Run linters (flake8, mypy)"
	@echo "  make format            - Format code with black"
	@echo "  make check             - Run all checks (test + lint)"

# Run all tests
test:
	python3 -m pytest tests/ -v

# Run unit tests only
test-unit:
	python3 -m pytest tests/ -v -m unit

# Run integration tests only
test-integration:
	python3 -m pytest tests/ -v -m integration

# Run tests with coverage report
test-coverage:
	python3 -m pytest tests/ -v --cov=core --cov=. --cov-report=term-missing --cov-report=html

# Run tests in watch mode (requires pytest-watch)
test-watch:
	python3 -m pytest_watch tests/ -v

# Clean generated files
clean:
	rm -rf .pytest_cache
	rm -rf htmlcov
	rm -rf .coverage
	rm -rf coverage.xml
	rm -rf __pycache__
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name '*.pyc' -delete
	find . -type f -name '*.pyo' -delete

# Install dependencies
install:
	pip3 install -r requirements.txt

# Install dev dependencies
install-dev:
	pip3 install -r requirements.txt
	pip3 install flake8 black mypy pytest-watch

# Run linters
lint:
	@echo "Running flake8..."
	-python3 -m flake8 core/ tests/ --max-line-length=100 --extend-ignore=E203,W503
	@echo "Running mypy..."
	-python3 -m mypy core/ --ignore-missing-imports

# Format code with black
format:
	python3 -m black core/ tests/ --line-length=100

# Run all checks
check: test lint
	@echo "All checks passed!"
