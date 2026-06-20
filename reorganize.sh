#!/bin/bash

# Clayton Forge — Reorganize script
# Run this from inside the folder where all .md files are dumped (the "files" folder)

echo "Starting Clayton Forge reorganization..."

# 1. Remove all .Zone.Identifier files
echo "Removing Zone.Identifier files..."
find . -name "*.Zone.Identifier" -delete
rm -f files.zip files.zip:Zone.Identifier 2>/dev/null

# 2. Create folder structure
echo "Creating folder structure..."
mkdir -p 00_FOUNDATIONS
mkdir -p 01_DESIGN
mkdir -p 02_PROTOCOLS
mkdir -p 03_MEMORY_SYSTEM
mkdir -p 04_PRODUCTION
mkdir -p 05_MULTI_AGENT
mkdir -p 06_OPERATIONS
mkdir -p 07_EXAMPLES/simple_agent
mkdir -p 07_EXAMPLES/tool_use_agent
mkdir -p 07_EXAMPLES/memory_agent
mkdir -p 07_EXAMPLES/orchestrator
mkdir -p 07_EXAMPLES/delivery_compliance_agent
mkdir -p 08_PROMPT_ENGINEERING
mkdir -p .github/ISSUE_TEMPLATE

# 3. Move files to correct folders

# 00_FOUNDATIONS
mv 01_agent_theory.md 00_FOUNDATIONS/ 2>/dev/null
mv 02_agent_taxonomy.md 00_FOUNDATIONS/ 2>/dev/null
mv 03_cognitive_architecture.md 00_FOUNDATIONS/ 2>/dev/null
mv 04_agent_vs_automation.md 00_FOUNDATIONS/ 2>/dev/null

# 01_DESIGN
mv PRD_template.md 01_DESIGN/ 2>/dev/null
mv SPEC_template.md 01_DESIGN/ 2>/dev/null
mv ARCHITECTURE_template.md 01_DESIGN/ 2>/dev/null
mv KNOWLEDGE_BASE_template.md 01_DESIGN/ 2>/dev/null

# 02_PROTOCOLS
mv agent_interface_contract.md 02_PROTOCOLS/ 2>/dev/null
mv message_schema.md 02_PROTOCOLS/ 2>/dev/null
mv orchestration_patterns.md 02_PROTOCOLS/ 2>/dev/null
mv trust_model.md 02_PROTOCOLS/ 2>/dev/null

# 03_MEMORY_SYSTEM
mv memory_architecture.md 03_MEMORY_SYSTEM/ 2>/dev/null
mv retrieval_patterns.md 03_MEMORY_SYSTEM/ 2>/dev/null
mv context_management.md 03_MEMORY_SYSTEM/ 2>/dev/null

# 04_PRODUCTION
mv production_guide.md 04_PRODUCTION/ 2>/dev/null
mv observability.md 04_PRODUCTION/ 2>/dev/null
mv cost_management.md 04_PRODUCTION/ 2>/dev/null
mv failure_handling.md 04_PRODUCTION/ 2>/dev/null
mv lifecycle_management.md 04_PRODUCTION/ 2>/dev/null

# 05_MULTI_AGENT
mv orchestrator_design.md 05_MULTI_AGENT/ 2>/dev/null
mv agent_registry.md 05_MULTI_AGENT/ 2>/dev/null
mv emergent_behavior.md 05_MULTI_AGENT/ 2>/dev/null

# 06_OPERATIONS
mv ISSUES_template.md 06_OPERATIONS/ 2>/dev/null
mv MEMORY_template.md 06_OPERATIONS/ 2>/dev/null
mv HANDOFF_template.md 06_OPERATIONS/ 2>/dev/null
mv RUNBOOK_template.md 06_OPERATIONS/ 2>/dev/null

# 07_EXAMPLES
mv ticket_classifier.md 07_EXAMPLES/simple_agent/ 2>/dev/null
mv order_status_assistant.md 07_EXAMPLES/tool_use_agent/ 2>/dev/null
mv customer_service_assistant.md 07_EXAMPLES/memory_agent/ 2>/dev/null
mv content_pipeline.md 07_EXAMPLES/orchestrator/ 2>/dev/null
mv full_example.md 07_EXAMPLES/delivery_compliance_agent/ 2>/dev/null

# 08_PROMPT_ENGINEERING
mv prompt_fundamentals.md 08_PROMPT_ENGINEERING/ 2>/dev/null
mv prompt_patterns.md 08_PROMPT_ENGINEERING/ 2>/dev/null
mv prompt_eval.md 08_PROMPT_ENGINEERING/ 2>/dev/null

# Root files stay where they are
# README.md, CONTRIBUTING.md, HANDOFF_SESSAO_01.md, HANDOFF_SESSAO_02.md, MEMORY_PROJETO.md

echo ""
echo "Done! Verifying structure..."
echo ""
find . -name "*.md" | grep -v ".Zone" | sort
echo ""
echo "Reorganization complete. Now run:"
echo "  git add ."
echo "  git commit -m 'Fix: correct folder structure'"
echo "  git push"
