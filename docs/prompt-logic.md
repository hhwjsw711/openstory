
# Core Logic

## Prompts

1. System Prompt - universal system prompt for all calls
 -



## Script -> Scenes

1. Combine the style stack, and enchance the script to get into a useable format. 
2. Extract characters and get identifiers for them
3. Split into scenes - include just enough detail for a useable prompt

### Tech
- Create API call to create a new sequence
- This API call sends back an SSE stream
- Client side receives events then updates the tanstack query cache


4. Create a still frame for each scene
5. Create a video from the frame for the screen script



## Steps