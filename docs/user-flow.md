## Step 1 - Script

Paste script into a field / editor

- Script (text)
- Style - Style Stack (presets + custom)

Click Generate Storyboard

### What Happens
1. Check the script - can we work with it? (use AI with a prompt to check it)
--- If yes, use the script as
--- If not, enhance the script and go to the next section. Make sure we tell them the script is modified

--- Version the script as they are typing. Save every 10s?

2. With the (enhanced) script, generate frame for the sequence (30s long)

Phase 2
2. Determine characters in the script
3. Generate images for each character


## Step 2 - Storyboard

The script is broken into frames with with sections of script. 

Lists out all the frames and the script section for each frame. 

Storyboard
- ID
- Style Stack

Frames
- Name (figured out by AI)
- Image
- Script Section
- Creative Direction (style, camera, specifics around the look). This is chat history
- JSON Prompt (not visible to user)
- Order
- Storyboard ID
- Deleted


On this screen, the user can CRUD frames:
- Update the script on a frame
- Can make edits to a frame's creative direction - this is just chat for now
- Add a frame?
-- Enter description for new frame
- Split the script over a couple of frames (AI determines if script needs enhancing to split)
- Delete a frame (mark as deleted)
- Move a frame around 

#### Frame Image Generation 
- Inputs
-- Script section
-- Style stack
-- Creative direction chat

- Create the image with Krea 


Generate Motion

## Step 3 - Motion

Just a moving version of the frame










