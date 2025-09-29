/**
 * GoDAM Video Integration for LearnDash
 * Handles toggling video URL fields and settings when GoDAM is used
 *
 * @since 1.4.4
 */

const GoDAMLearnDashAdminIntegration = {
	/**
	 * Initialize the integration
	 *
	 * @since 1.4.4
	 */
	init() {
		this.cacheElements();
		this.isGoDAMEnabled();
		this.bindEvents();
	},

	/**
	 * Cache DOM elements for later use
	 *
	 * @since 1.4.4
	 */
	cacheElements() {
		this.videoUrlInput = document.querySelector(
			'#learndash-lesson-display-content-settings_lesson_video_url, ' +
				'#learndash-topic-display-content-settings_lesson_video_url',
		);

		this.settingsToHide = document.querySelectorAll(
			'#learndash-lesson-display-content-settings_lesson_video_url_field, ' +
				'#learndash-lesson-display-content-settings_lesson_video_focus_pause_field, ' +
				'#learndash-lesson-display-content-settings_lesson_video_auto_start_field, ' +
				'#learndash-lesson-display-content-settings_lesson_video_show_controls_field, ' +
				'#learndash-lesson-display-content-settings_lesson_video_track_time_field, ' +
				'#learndash-topic-display-content-settings_lesson_video_url_field, ' +
				'#learndash-topic-display-content-settings_lesson_video_focus_pause_field, ' +
				'#learndash-topic-display-content-settings_lesson_video_auto_start_field, ' +
				'#learndash-topic-display-content-settings_lesson_video_show_controls_field, ' +
				'#learndash-topic-display-content-settings_lesson_video_track_time_field',
		);

		this.godamToggle = document.querySelector(
			'#learndash-lesson-display-content-settings_lesson_godam_block_progression_enabled, ' +
				'#learndash-topic-display-content-settings_lesson_godam_block_progression_enabled',
		);
	},

	/**
	 * We check the Video URL field to see
	 * if it has the value `(rtgodam` in it.
	 *
	 * @since 1.4.4
	 */
	isGoDAMEnabled() {
		if ( ! this.videoUrlInput ) {
			return;
		}

		const videoUrl = this.videoUrlInput.value || '';

		if ( videoUrl.includes( '(rtgodam' ) ) {
			this.toggleSettings( false );
			if ( this.godamToggle ) {
				this.godamToggle.checked = true;
			}
		}
	},

	/**
	 * Bind change events to the GoDAM toggle
	 *
	 * @since 1.4.4
	 */
	bindEvents() {
		if ( ! this.godamToggle ) {
			return;
		}

		this.godamToggle.addEventListener( 'change', () => {
			if ( this.godamToggle.checked ) {
				this.videoUrlInput.value = '(rtgodam)';
				this.toggleSettings( false );
			} else {
				this.toggleSettings( true );
				if ( this.videoUrlInput.value.includes( '(rtgodam' ) ) {
					this.videoUrlInput.value = '';
				}
			}
		} );
	},

	/**
	 * Toggle visibility of settings fields
	 *
	 * @since 1.4.4
	 *
	 * @param {boolean} show
	 */
	toggleSettings( show ) {
		this.settingsToHide.forEach( ( el ) => {
			el.style.display = show ? '' : 'none';
		} );
	},
};

/**
 * Initialize when document is ready
 */
document.addEventListener( 'DOMContentLoaded', function() {
	GoDAMLearnDashAdminIntegration.init();
} );

// Expose globally if needed
window.GoDAMLearnDashAdminIntegration = GoDAMLearnDashAdminIntegration;
