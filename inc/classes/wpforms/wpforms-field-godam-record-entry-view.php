<?php
/**
 * Template/View which is render on the WPForms View Entry page for the GoDAM Video Recorder field.
 *
 * @package GoDAM
 *
 * @since n.e.x.t
 */

?>

<div class="godam-video-preview">
	<?php
		// No need to escape here, the entire template will be returned as strings,
		// which will be alter on escaped using wp_kses_post() by WPForms before rendering the field
		// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		echo force_balance_tags( do_shortcode( "[godam_video poster='{$thumbnail_url}' src='{$attachment_url}' transcoded_url='{$transcoded_url}']" ) );
	?>
</div>
