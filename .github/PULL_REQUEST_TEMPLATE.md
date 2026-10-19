## Purpose
- Clear, easy-to-understand sentences outlining the purpose of the PR
## Proposed Changes
- [ADD] ...
- [CHANGE] ...
- [FIX] ...
## Issues
- Links to relevant issues
- Example: issue-XYZ
## Testing
- Provide some proof you've tested your changes 
- Example: test results available at ...
- Example: tested on operating system ...
## Feature areas impacted
<!-- Capability IDs from tests/capabilities.yml (e.g. UIF-LAYERS-FILTER). Add a row per capability touched. -->
| Capability | Levels added/updated (unit / api / flow) | Test files | Corner cases covered |
|---|---|---|---|
|  |  |  |  |

- [ ] New/changed tests are tagged with capability or scenario IDs, or their files are mapped in `tests/capabilities.yml`
- [ ] User-visible changes have a `flow` test; new behaviour has a scenario in `tests/capabilities.yml`
- [ ] Checked the `capability-coverage-report` artifact of the Playwright Tests run
