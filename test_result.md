#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Thermal Casting LLP Enterprise Platform. AI-native, ERP-ready Expo mobile app with FastAPI + MongoDB.
  Latest requests:
    1. Fix app preview crash caused by fontfaceobserver 6000ms timeout in useIconFonts.
    2. Build a complete Media Library management system (upload, preview, replace, delete) with
       size/type validation & progress.
    3. Allow admin to pick existing Media Library assets from other admin screens (Product,
       Company, News, and any future admin form) — via a reusable component.

backend:
  - task: "DELETE /api/admin/media/{id} — cascade unlink of physical file"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Enhanced delete media to look up upload_id, remove the file from /app/backend/uploads, and delete the uploads collection entry along with the media doc. 404 preserved for missing ids. Audit log intact."
  - task: "PATCH /api/admin/media/{id} update fields"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Unchanged in this pass but must remain functional (title/description/category/featured/tags update)."
  - task: "POST /api/admin/media/{id}/replace"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Replace flow keeps deleting the previous physical file if different. Existing implementation."
  - task: "POST /api/admin/upload with save_to_library=true"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "UploadField now always sets save_to_library=true so any admin form upload is available via GET /api/media. Verify media doc auto-created with correct media_type."

frontend:
  - task: "App preview crash fix — fontfaceobserver timeout"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/hooks/use-icon-fonts.ts, /app/frontend/app/_layout.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "useIconFonts swallows CDN errors and never gates rendering. _layout mounts app immediately. Screenshot at /app root confirms app loads without crash."
  - task: "Media Library admin screen — upload / preview / replace / delete"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/admin/media-library.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Screen supports pick image/video, size limits (20MB image, 100MB video), upload progress bar %, title/category/featured metadata, filter chips, search, per-row edit (title/description/category/tags/featured), replace and delete with confirmation. Linked into Admin Hub as MEDIA LIBRARY card."
  - task: "Reusable MediaPicker component"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/media-picker.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Bottom-sheet modal with 3-column grid, search, kind filtering (image/video/pdf/brochure/certificate/any). Selects a MediaItem and returns url."
  - task: "UploadField refactor — Library / Gallery / Camera / Upload"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/upload-field.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Now supports image/video/doc kinds. Adds LIBRARY button that opens MediaPicker. Upload always indexes into Media Library via save_to_library=true. Progress bar with %. Automatically wired into Product Edit, Company Profile, News Editor (all screens using UploadField)."

metadata:
  created_by: "main_agent"
  version: "1.2"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "DELETE /api/admin/media/{id} — cascade unlink of physical file"
    - "POST /api/admin/upload with save_to_library=true"
    - "Media Library admin screen — upload / preview / replace / delete"
    - "Reusable MediaPicker component"
    - "UploadField refactor — Library / Gallery / Camera / Upload"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Media Library upgrade + app-preview crash fix implemented. See tasks above.
    - agent: "testing"
      message: |
        Verified end-to-end. Backend 11/11 pytest passed:
          • admin login OK
          • POST /api/admin/upload save_to_library=true → creates media
          • PATCH updates fields, POST /replace deletes old file, DELETE removes item AND physical file
          • Regression endpoints (products/categories/materials/company) all 200
        Frontend verified via 390x844 mobile viewport:
          • App loads without any 6000ms fontfaceobserver crash
          • Admin Hub shows MEDIA LIBRARY card
          • UploadField in Product / Company / News now shows LIBRARY + GALLERY + CAMERA
          • MediaPicker modal opens, searches, filters and picks correctly
          • Media Library screen: chips filter, search filter, edit / replace / delete flows work
        Non-blocking: RN-Web deprecation warnings (Image.resizeMode, props.pointerEvents).
        No mocks. All tasks working.
    - agent: "main"
      message: |
        Iteration 6 — final QA pass before deploy. Fixed:
          1. Android bottom nav safe-area overlap in (tabs)/_layout.tsx
          2. Media Library sync — added useFocusEffect on (tabs)/home.tsx and media.tsx so admin edits appear on next tab focus
          3. Custom video thumbnails — admin can upload/pick/remove a cover image in Media Library edit modal (thumbnail_url); Home + /media video cards show that thumbnail or a proper dark videocam placeholder (never company hero fallback)
          4. Admin Portal remains inside the same app, still auth-protected
    - agent: "testing"
      message: |
        Iteration 6 verified. Backend 12/12 pytest passed (media PATCH with thumbnail_url, /media/videos immediate reflect, clear-null, DELETE). Frontend at 390x844 + 411x731: tab bar clickable + safe-area respected on both, admin portal opens /admin in-app and denies without auth, media edits reflect on Home and /media, custom thumbnails render, removing thumbnail shows dark placeholder (never hero image). Only cosmetic RN-Web pointerEvents deprecation warning. Green light for deploy.
