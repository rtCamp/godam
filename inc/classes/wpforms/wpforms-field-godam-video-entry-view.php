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
	<?php force_balance_tags( do_shortcode( "[godam_video poster='{$thumbnail_url}' src='{$attachment_url}' transcoded_url='{$transcoded_url}']" ) ); ?>
</div>
