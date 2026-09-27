# Registration schema

## Team

- Team name
- Team tag
- Captain name
- Captain contact
- Optional team logo
- Acceptance of tournament rules

## Player

For each player:

- in-game name (IGN)
- MLBB account ID
- server ID
- role (optional)
- captain flag
- substitute flag

## Internal fields

Do not expose these as ordinary registration inputs:

- team ID
- registration timestamp
- verification state
- check-in state
- eligibility flags
- staff notes
- seed
- disqualification state

## Validation requirements

- exactly five starters before check-in closes;
- no duplicate account ID + server ID combination across active rosters;
- captain must be on the roster;
- substitute count must not exceed the tournament configuration;
- final registration should preserve an audit trail when staff edits data.
