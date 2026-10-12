
## Record vs code

- record: read: 3 Components, 4 Functions (contour.yaml, morph-map.json)
- recorded, not built (2):
  - units/Format Total: missing src/units/formatTotal.ts
  - units/Parse Line: no Morph-Card commit
- built, not recorded (2):
  - src/index.ts
  - src/units/money.ts
- Component weight, heaviest first (1 of 3 over 30000 bytes):
  - heavy: 31358 bytes — over the rule
  - units: 1007 bytes
  - report: 497 bytes
- record warnings (5):
  - System.groups[0]: unknown key 'owner' (ignored)
  - no language on Component report and none in the map: typescript assumed
  - units/Format Total: step produces 'Total Text' names no Data Object or Event of the record
  - units/Parse Line: step reads 'Line' names no Data Object or Event of the record
  - units/Parse Line: no examples, no judge
- layer gaps (1):
  - src/units → src/report (src/units/money.ts)
