# Changelog #

## v1.4.6 (November 12, 2025) ##

- Tweak: Added audio recorder support for Ninja Forms with GoDAM Recorder
- Tweak: Added GoDAM Media Tab to Video Ad, CTA background, watermark selectors & more
- Fix: Resolved copy block issue on Safari
- Fix: Improved security measures for HTTP requests
- Fix: Fixed critical Node package vulnerabilities
- Fix: Fixed API key being removed on 5xx server errors
- Fix: Fixed GoDAM Recorder videos visibility in Fluent Forms entry pages
- Fix: Fixed virtual media attachment creation in WP Media Library
- Fix: Made improvements in media selection UI
- Fix: Fixed Elementor widgets not appearing when GoDAM plugin is network activated
- Fix: Fixed fullscreen toggle inconsistencies on iOS
- Fix: Fixed a search issue in the GoDAM media tab

## v1.4.5 (October 22, 2025) ##

- Fix: Optimized API requests

## v1.4.4 (October 16, 2025) ##

- Tweak: Introduced GoDAM Player SDK for developer integrations
- Fix: Fixed the Copy Block feature for .mov videos
- Fix: Fixed network errors for analytics

## v1.4.3 (October 9, 2025) ##

- Tweak: Enhanced Analytics with Google Tag Manager (GTM) event tracking
- Tweak: Improved overall plugin performance
- Tweak: Implemented custom branding for GoDAM Gutenberg Blocks
- Tweak: Updated WordPress role-based access controls
- Fix: Fixed Quality option visibility inconsistencies

## v1.4.2 (September 25, 2025) ##

- Tweak: Allow replacing transcoded MP4 video with the original uploaded video
- Fix: Resolved LifterLMS warnings and applied necessary bug fixes
- Fix: Restored analytics tracking for GoDAM Gallery videos
- Fix: Fixed GoDAM Recorder playback issue when rtMedia plugin is active
- Fix: Addressed Safari browser issue where audio would not play or seek correctly

## v1.4.1 (September 17, 2025) ##

- Tweak: Enhanced Audio Recording support in GoDAM Recorder for Gravity Forms
- Fix: Video player UI bugs and playback quality issues

## v1.4.0 (September 9, 2025) ##

- New: Added integration for LifterLMS
- New: Added Ninja Forms and MetForm layer integration
- New: Added GoDAM Recorder Field for Everest Forms and Ninja Forms
- New: Added Engagements for GoDAM Video and Gallery with Views, Likes, and Comments
- New: Implemented Migration Tools for existing videos and Vimeo videos to GoDAM
- New: Added Speech-to-text functionality using AI transcriptions
- New: Added Custom Thumbnail Upload option for videos
- New: Enabled different Hover-Interactions for videos
- Tweak: Improved compatibility with Elementor
- Tweak: Updated Media Library UI
- Fix: Fixed iOS compatibility
- Fix: Resolved re-transcoding ID preservation to maintain video continuity and prevent data loss

## v1.3.5 (August 26, 2025) ##

- Tweak: Set transcoded videos as public by default and add Org support parameters
- Tweak: Provide HLS URL support for GoDAM Virtual Media

## v1.3.4 (August 11, 2025) ##

- Fix: Video Editor UI issues

## v1.3.3 (August 11, 2025) ##

- Tweak: Improved video player controls and HLS URL handling
- Tweak: Added Video SEO support and duplicate prevention for GoDAM Tab videos
- Tweak: Player-specific video speed and quality settings
- Fix: Resolved share button and JavaScript registration issues

## v1.3.2 (August 6, 2025) ##

- Fix: Resolved PHP Warning on admin pages

## v1.3.1 (August 4, 2025) ##

- Tweak: Added settings for CPT visibility in permalinks
- Tweak: Improved Media Library interface with search and pagination
- Tweak: Improved UI for buttons and modals
- Tweak: Enhanced hover actions for GoDAM Video blocks
- Tweak: Improved mobile responsiveness for settings sidebar navigation
- Fix: iPhone compatibility - HLS URL for Transcoded videos
- Fix: Video SEO data visibility
- Fix: Virtual Media errors in Analytics requests
- Fix: GoDAM Video Player style compatibility with themes
- Fix: Aspect ratio of video container in Form's GoDAM Record submissions

## v1.3.0 (July 22, 2025) ##

- New: Integrated [Everest Forms](https://godam.io/integrations/everest-forms/)
- New: Integrated [Forminator Forms](https://godam.io/integrations/forminator-forms/)
- New: Integrated [Fluent Forms](https://godam.io/integrations/fluent-forms/) and added GoDAM Recorder Field integration
- New: Integrated [SureForms](https://godam.io/integrations/sureforms/) and added GoDAM Recorder Field integration
- New: Added GoDAM Recorder Field integration for [WPForms](https://godam.io/integrations/wp-forms/) to capture video submissions
- New: Implemented theme support for customizable video player appearance
- New: Added Global Ads settings for centralized advertisement management
- New: Implemented automatic autoplay disable when video audio is unmuted for better user experience
- New: Added Bookmarks and Lock functionality for improved Media Library folder organization
- New: Extended free version support to include MOV files and FLV formats (some codecs)
- New: Introduced Background Color for Image CTA Layer Button
- Tweak: Added Custom Post Type support for GoDAM Videos
- Tweak: Redesigned Media Library user interface for improved usability and navigation
- Tweak: Improved Layer Selection interface with tabs and search functionality
- Fix: Resolved overlapping button issues in Video Editor when viewing video content
- Fix: Added comprehensive translations for previously untranslated interface strings
- Fix: Eliminated display of "0" value after removing images in Image CTA Layer
- Fix: Updated Share Button and Share Modal visibility on GoDAM Video block
- Fix: Added validation for empty form selection in form layers

## v1.2.1 (July 11, 2025) ##

- Fix: Resolved thumbnail issue with rtMedia for transcoded videos

## v1.2.0 (July 2, 2025) ##

- Update: Bumped the version to reflect all major features and fixes added in the last release (v1.1.4)
- Fix: Prevented creation of new image attachments for video thumbnails
- Fix: Addressed security vulnerabilities in the transcoding callback process

## v1.1.4 (June 25, 2025) ##

- New: Added [Jetpack Forms Integration](https://godam.io/features/jetpack/) to GoDAM Video Block
- New: Added [Elementor widgets](https://godam.io/features/elementor/) for GoDAM Video, Gallery, and Audio to enable easy media embedding via drag-and-drop
- New: Added Block Overlay feature to GoDAM Video Block with customizable timing
- New: Added "Video Player" settings menu with support to add custom CSS to modify and style the UI of video player globally
- New: Introduced `godam_player_enqueue_styles` hook for registering custom styles for GoDAM video blocks. Read more in [docs](https://godam.io/docs/overview/).
- New: Consolidated video quality selector and playback speed controls into a unified player settings UI
- New: Implemented chapters feature for enhanced video navigation
- Tweak: GoDAM Gallery Modal made more user-friendly and scrollable in fullscreen
- Fix: GoDAM Record field data disappearing after invalid submission
- Fix: Transcoded videos showing as Not Transcoded in DAM Tab
- Fix: Show Transcoding Status for Retranscoding videos
- Fix: Poll layer submission issues

## v1.1.3 (June 6, 2025) ##

- Fix: Implemented a custom endpoint to retrieve and display the list of WPForms on the Video Editor page.
- Fix: Enabled watermarking functionality for users on the Starter plan.
- Fix: Update overlapping Modal Popup UI for GoDAM Gallery.
- Tweak: Reorganized the GoDAM admin menu for improved navigation.
- Tweak: Added a clear guidance message on Analytics pages for cases where videos have been deleted.

## v1.1.2 (June 5, 2025) ##

- New: Added a “Share” button to enable sharing of single video pages in the Central Media Manager.
- New: Introduced the GoDAM Video Gallery block and shortcode for displaying videos on the frontend.
- Enhance: Improved video player UI for better mobile viewing experience.

## v1.1.1 (May 30, 2025) ##

- Fix: Plugin release actions to generate compressed plugin zip file.

## v1.1.0 (May 29, 2025) ##

- New: Central Media Manager – Unified media dashboard with folders, filters, search, and public sharing.
- New: Central Media Selector Tab – New tab to import media from the Central Media Manager directly into the WordPress media library.
- New: Image Upload to Central Media Manager – Upload and organize image files into the central media library.
- New: GoDAM Recorder Field for Gravity Forms – Record webcam or screen video directly within a form submission.
- New: Automatic Video Transcription – AI-generated captions added automatically to uploaded videos.
- New: Built-in Video SEO – Generate video schema with title, description, thumbnail and more for improved search engine discoverability.
- New: Video Optimization at Upload – Auto-compression and resizing of uploaded videos to optimize bandwidth and storage.
- New: WPForms & Contact Form 7 Integration – Add interactive form layers to videos using your preferred form plugins.
- New: [godam_video] Shortcode – Embed a video anywhere using its media ID.
- New: Advanced Video Analytics Dashboard – View plays, watch time, engagement, regional performance, and top-performing videos.
- Tweak: Improved Single Video Analytics Page – Compare videos, view playback metrics, and explore geographical heatmaps.
- Tweak: Video Editor UX – Edit timestamps for interactive video layers.
- Tweak: Keyboard Accessibility – Improved keyboard navigation and accessibility within the GoDAM video player.

## v1.0.8 (May 27, 2025) ##

- Fix: Renamed functions and added checks for function existence to prevent fatal errors caused by other plugin functions.

## v1.0.7 (May 22, 2025) ##

- Fix: Update the POT creation process for translation.
- Fix: Analytics event data for non logged-in users.

## v1.0.6 (May 16, 2025) ##

- Fix: Updated translation files.

## v1.0.5 (May 15, 2025) ##

- Fix: Updated plugin to support translations and localization.
- Tweak: Added compatibility for displaying thumbnails in the rtMedia gallery view.

## v1.0.4 (May 14, 2025) ##

- Fix: Added CDN detection to prevent conflicts with GoDAM’s transcoding.
- Fix: Resolved translation issues across plugin interfaces.
- Tweak: Redesigned the Video Editor interface for a smoother editing experience.
- Tweak: Refreshed the UI of Settings pages for improved usability.
- New: Added support for interactive Polls layer in video editor.
- New: Introduced the new GoDAM Audio Block for displaying audio content from CDN.

## v1.0.3 (April 22, 2025) ##

- Fix: Video player ads related console errors, and add optional chaining to avoid console errors.
- Fix: Addressed an edge case where users couldn't save a new API key if the previous one had expired.
- Fix: Update the settings page links and wordings.
- New: Improve the GoDAM video player UI.
- New: Enabled the watermark feature for users on the Starter plan.

## v1.0.2 (April 15, 2025) ##

- Fix: Enhance accessibility features for the media library

## v1.0.1 (April 14, 2025) ##

- Fix: FAQ formatting for readme.txt.
- Fix: Ad loading logic for third-party and self-hosted ads.
- Fix: Enhance the GoDAM video player's UI for mobile devices.

## v1.0.0 (March 05, 2025) ##

- New: Initial release of GoDAM plugin.
- New: Automatic transcoding for audio and video files.
- New: Adaptive bitrate streaming for smooth playback.
- New: Interactive video layers (CTAs, forms, hotspots, ads).
- New: Customizable video player with branding option.
- New: Cloud storage and CDN integration.
- New: Advanced analytics and engagement tracking.
- New: Enhanced WordPress Media Library for better asset management.
