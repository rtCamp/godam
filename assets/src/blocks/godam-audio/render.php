<?php
/**
 * Render template for the GoDAM Audio Block.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$godam_attachment_id = ! empty( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
$godam_src           = ! empty( $attributes['src'] ) ? esc_url( $attributes['src'] ) : '';
$godam_autoplay      = ! empty( $attributes['autoplay'] ) ? 'autoplay' : '';
$godam_loop          = ! empty( $attributes['loop'] ) ? 'loop' : '';
$godam_preload       = ! empty( $attributes['preload'] ) ? esc_attr( $attributes['preload'] ) : 'metadata';
$godam_audio_title   = ! empty( $attributes['audioTitle'] ) ? $attributes['audioTitle'] : '';
$godam_description   = ! empty( $attributes['description'] ) ? $attributes['description'] : '';
$godam_thumbnail     = ! empty( $attributes['thumbnail'] ) ? esc_url( $attributes['thumbnail'] ) : '';

// The [godam_audio] shortcode only passes an id (no title/thumbnail block
// attributes), so fall back to the attachment's own data — the title and the
// GoDAM cover stored in rtgodam_media_audio_thumbnail — to match the block.
if ( $godam_attachment_id ) {
	if ( '' === $godam_audio_title ) {
		$godam_audio_title = get_the_title( $godam_attachment_id );
	}
	if ( '' === $godam_thumbnail ) {
		$godam_meta_thumbnail = get_post_meta( $godam_attachment_id, 'rtgodam_media_audio_thumbnail', true );
		if ( ! empty( $godam_meta_thumbnail ) ) {
			$godam_thumbnail = esc_url( $godam_meta_thumbnail );
		}
	}
}

// The transcript toggle defaults to on when the attribute is absent.
$godam_show_transcript = ! array_key_exists( 'showTranscript', $attributes ) || ! empty( $attributes['showTranscript'] );
$godam_show_chapters   = ! array_key_exists( 'showChapters', $attributes ) || ! empty( $attributes['showChapters'] );

// Chapters live on the attachment's rtgodam_meta; the transcript is a caption
// file URL cached in the rtgodam_transcript_path meta.
$godam_meta_all     = $godam_attachment_id ? get_post_meta( $godam_attachment_id, 'rtgodam_meta', true ) : array();
$godam_chapters_raw = ( is_array( $godam_meta_all ) && ! empty( $godam_meta_all['chapters'] ) ) ? $godam_meta_all['chapters'] : array();

// Read ONLY the cached transcript path, and only when the toggle is on. Never
// call godam_get_transcript_path() at render time: on a cache miss it makes a
// blocking wp_remote_post() to the SaaS (on public, unauthenticated page loads)
// and re-caches the path without the delete guard, which would resurrect a
// transcript the user deleted. Discovery + caching happen in the authenticated
// editor (block canvas + customization editor) via the /godam/v1/transcription
// route, which applies that guard.
$godam_transcript_url = ( $godam_attachment_id && $godam_show_transcript )
	? (string) get_post_meta( $godam_attachment_id, 'rtgodam_transcript_path', true )
	: '';

// Chapters are normally stored as an array, but tolerate a JSON string (old
// installs / external sources) so the foreach below never warns.
if ( is_string( $godam_chapters_raw ) ) {
	$godam_decoded_chapters = json_decode( $godam_chapters_raw, true );
	$godam_chapters_raw     = is_array( $godam_decoded_chapters ) ? $godam_decoded_chapters : array();
} elseif ( ! is_array( $godam_chapters_raw ) ) {
	$godam_chapters_raw = array();
}

// Normalise chapters for both server rendering and the front-end script.
$godam_chapters = array();
foreach ( $godam_chapters_raw as $godam_chapter ) {
	$godam_chapters[] = array(
		'start' => isset( $godam_chapter['startTime'] ) ? floatval( $godam_chapter['startTime'] ) : 0,
		'text'  => isset( $godam_chapter['text'] ) ? (string) $godam_chapter['text'] : '',
	);
}

// Sort by start time. Chapters are stored in authoring order (not necessarily
// chronological), but the rendered list and the front-end active-line logic
// (which derives each chapter's window from the next row) both assume ascending
// order — matching how the editor preview sorts via getChapterRows().
usort(
	$godam_chapters,
	static function ( $a, $b ) {
		return $a['start'] <=> $b['start'];
	}
);

// Each tab shows only when its own toggle is on and it has content; the panel
// appears when at least one tab is visible.
$godam_chapters_visible   = $godam_show_chapters && ! empty( $godam_chapters );
$godam_transcript_visible = $godam_show_transcript && ! empty( $godam_transcript_url );
$godam_has_panel          = $godam_chapters_visible || $godam_transcript_visible;

// Chapters is the first tab, so it is active when visible; the transcript is
// active only when chapters is hidden. Pre-build class / aria / hidden strings
// so the markup only echoes escaped values.
$godam_chapters_active      = $godam_chapters_visible;
$godam_transcript_active    = $godam_transcript_visible && ! $godam_chapters_visible;
$godam_chapters_tab_class   = 'godam-audio-tabs__tab' . ( $godam_chapters_active ? ' is-active' : '' );
$godam_transcript_tab_class = 'godam-audio-tabs__tab' . ( $godam_transcript_active ? ' is-active' : '' );
$godam_chapters_aria        = $godam_chapters_active ? 'true' : 'false';
$godam_transcript_aria      = $godam_transcript_active ? 'true' : 'false';
$godam_chapters_hidden      = $godam_chapters_active ? '' : 'hidden';
$godam_transcript_hidden    = $godam_transcript_active ? '' : 'hidden';

if ( ! $godam_attachment_id && empty( $godam_src ) ) {
	return;
}

if ( ! $godam_attachment_id && ! empty( $godam_src ) ) {
	// Virtual attachment scenario.
	$godam_primary_audio = $godam_src;
	$godam_backup_audio  = '';
} else {
	$godam_primary_audio = get_post_meta( $godam_attachment_id, 'rtgodam_transcoded_url', true );
	$godam_backup_audio  = wp_get_attachment_url( $godam_attachment_id );

	if ( empty( $godam_primary_audio ) && empty( $godam_backup_audio ) ) {
		return;
	}
}
// Root wrapper: emit a stable `godam-audio` hook class that view.js targets on
// both render paths. In block context also merge WordPress' block-support
// attributes (align/spacing/etc.); the [godam_audio] shortcode sets
// $godam_is_shortcode and runs outside a block, where get_block_wrapper_attributes()
// would raise a warning, so it gets just the hook class.
$godam_wrapper_attributes = empty( $godam_is_shortcode )
	? get_block_wrapper_attributes( array( 'class' => 'godam-audio' ) )
	: 'class="godam-audio"';
?>

<figure data-test-id="godam-audio-render" <?php echo wp_kses_data( $godam_wrapper_attributes ); ?>>
	<div class="godam-audio-card">
		<div class="godam-audio-card__head">

			<?php /* Thumbnail */ ?>
			<div class="godam-audio-card__cover" data-test-id="godam-audio-render-cover">
				<?php if ( $godam_thumbnail ) : ?>
					<img
						src="<?php echo esc_url( $godam_thumbnail ); ?>"
						alt="<?php echo esc_attr( $godam_audio_title ? $godam_audio_title : __( 'Audio thumbnail', 'godam' ) ); ?>"
					/>
				<?php endif; ?>
			</div>

			<?php /* Info + player */ ?>
			<div class="godam-audio-card__body">
				<p class="godam-audio-card__title" data-test-id="godam-audio-render-title"><?php echo esc_html( $godam_audio_title ? $godam_audio_title : __( 'Untitled audio', 'godam' ) ); ?></p>

				<?php if ( $godam_description ) : ?>
					<p class="godam-audio-card__description" data-test-id="godam-audio-render-description"><?php echo esc_html( $godam_description ); ?></p>
				<?php endif; ?>

			<?php
			/*
			 * Media element without native `controls`: the custom player below is
			 * rendered server-side (no flash of native chrome) and view.js wires
			 * playback onto it. The <noscript> block restores native controls when
			 * JavaScript is unavailable.
			 */
			?>
			<audio
				class="godam-audio-card__player"
				data-test-id="godam-audio-render-player"
				<?php echo esc_attr( $godam_autoplay ); ?>
				<?php echo esc_attr( $godam_loop ); ?>
				preload="<?php echo esc_attr( $godam_preload ); ?>"
			>
				<?php if ( ! empty( $godam_primary_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_primary_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php if ( ! empty( $godam_backup_audio ) ) : ?>
					<source src="<?php echo esc_url( $godam_backup_audio ); ?>" type="audio/mpeg" />
				<?php endif; ?>

				<?php esc_html_e( 'Your browser does not support the audio element.', 'godam' ); ?>
			</audio>

			<?php /* Custom player chrome (play/pause, seek, duration) — matches the block editor + preview. */ ?>
			<div class="godam-audio-player">
				<button type="button" class="godam-audio-player__play" aria-label="<?php esc_attr_e( 'Play', 'godam' ); ?>">
					<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
				</button>
				<input
					type="range"
					class="godam-audio-player__scrubber"
					min="0"
					max="0"
					step="0.1"
					value="0"
					style="--godam-audio-progress: 0%;"
					aria-label="<?php esc_attr_e( 'Seek', 'godam' ); ?>"
				/>
				<span class="godam-audio-player__time">0:00</span>
			</div>

			<noscript>
				<?php /* Without JS, view.js never fetches/renders the transcript, so hide its "Loading…" placeholder (and the custom player, which also needs JS). */ ?>
				<style>.godam-audio .godam-audio-player{display:none;}.godam-audio [data-godam-transcript-loading]{display:none;}</style>
				<audio
					class="godam-audio-card__player"
					controls
					<?php echo esc_attr( $godam_autoplay ); ?>
					<?php echo esc_attr( $godam_loop ); ?>
					preload="<?php echo esc_attr( $godam_preload ); ?>"
				>
					<?php if ( ! empty( $godam_primary_audio ) ) : ?>
						<source src="<?php echo esc_url( $godam_primary_audio ); ?>" type="audio/mpeg" />
					<?php endif; ?>

					<?php if ( ! empty( $godam_backup_audio ) ) : ?>
						<source src="<?php echo esc_url( $godam_backup_audio ); ?>" type="audio/mpeg" />
					<?php endif; ?>
				</audio>
			</noscript>
		</div>

	</div>

	<?php if ( $godam_has_panel ) : ?>
		<div
			class="godam-audio-tabs"
			data-test-id="godam-audio-render-tabs"
			data-godam-audio-panel
			data-godam-chapters="<?php echo esc_attr( wp_json_encode( $godam_chapters ) ); ?>"
			data-godam-transcript="<?php echo esc_url( $godam_transcript_url ); ?>"
		>
			<div class="godam-audio-tabs__bar">
				<div class="godam-audio-tabs__nav" role="tablist">
					<?php if ( $godam_chapters_visible ) : ?>
						<button type="button" class="<?php echo esc_attr( $godam_chapters_tab_class ); ?>" role="tab" aria-selected="<?php echo esc_attr( $godam_chapters_aria ); ?>" data-godam-tab="chapters">
							<?php esc_html_e( 'Chapters', 'godam' ); ?>
						</button>
					<?php endif; ?>
					<?php if ( $godam_transcript_visible ) : ?>
						<button type="button" class="<?php echo esc_attr( $godam_transcript_tab_class ); ?>" role="tab" aria-selected="<?php echo esc_attr( $godam_transcript_aria ); ?>" data-godam-tab="transcript">
							<?php esc_html_e( 'Transcript', 'godam' ); ?>
						</button>
					<?php endif; ?>
				</div>
				<button type="button" class="godam-audio-tabs__toggle" aria-expanded="true" aria-label="<?php esc_attr_e( 'Toggle panel', 'godam' ); ?>">
					<span class="dashicons dashicons-arrow-down-alt2"></span>
				</button>
			</div>

			<div class="godam-audio-tabs__body">
				<?php if ( $godam_chapters_visible ) : ?>
				<div class="godam-audio-tabs__panel" data-godam-panel="chapters" role="tabpanel" <?php echo esc_attr( $godam_chapters_hidden ); ?>>
					<?php if ( ! empty( $godam_chapters ) ) : ?>
						<ul class="godam-audio-tabs__list">
							<?php foreach ( $godam_chapters as $godam_chapter ) : ?>
								<?php
								$godam_cs    = (int) floatval( $godam_chapter['start'] );
								$godam_stamp = $godam_cs >= 3600
								? sprintf( '%d:%02d:%02d', floor( $godam_cs / 3600 ), floor( ( $godam_cs % 3600 ) / 60 ), $godam_cs % 60 )
								: sprintf( '%d:%02d', floor( $godam_cs / 60 ), $godam_cs % 60 );
								?>
							<li>
									<button type="button" class="godam-audio-tabs__row" data-godam-start="<?php echo esc_attr( $godam_chapter['start'] ); ?>">
										<span class="godam-audio-tabs__stamp"><?php echo esc_html( $godam_stamp ); ?></span>
										<span class="godam-audio-tabs__row-text"><?php echo esc_html( $godam_chapter['text'] ); ?></span>
									</button>
								</li>
							<?php endforeach; ?>
						</ul>
					<?php else : ?>
						<p class="godam-audio-tabs__empty"><?php esc_html_e( 'No chapters to show', 'godam' ); ?></p>
					<?php endif; ?>
				</div>
				<?php endif; ?>

				<?php if ( $godam_transcript_visible ) : ?>
				<div class="godam-audio-tabs__panel" data-godam-panel="transcript" role="tabpanel" <?php echo esc_attr( $godam_transcript_hidden ); ?>>
					<?php if ( ! empty( $godam_transcript_url ) ) : ?>
						<p class="godam-audio-tabs__empty" data-godam-transcript-loading><?php esc_html_e( 'Loading transcript…', 'godam' ); ?></p>
					<?php else : ?>
						<p class="godam-audio-tabs__empty"><?php esc_html_e( 'No transcript to show', 'godam' ); ?></p>
					<?php endif; ?>
				</div>
				<?php endif; ?>
			</div>
		</div>
	<?php endif; ?>
	</div>
</figure>
