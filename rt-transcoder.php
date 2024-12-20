<?php

/**
 * Plugin Name: Transcoder
 * Plugin URI: https://rtmedia.io/transcoder/?utm_source=dashboard&utm_medium=plugin&utm_campaign=transcoder
 * Description: Audio & video transcoding services for ANY WordPress website. Allows you to convert audio/video files of any format to a web-friendly format (mp3/mp4).
 * Version: 1.3.6
 * Text Domain: transcoder
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=transcoder
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package Transcoder
 */

if ( ! defined( 'RT_TRANSCODER_PATH' ) ) {
	/**
	 * The server file system path to the plugin directory
	 */
	define( 'RT_TRANSCODER_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_URL' ) ) {
	/**
	 * The url to the plugin directory
	 */
	define( 'RT_TRANSCODER_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_BASE_NAME' ) ) {
	/**
	 * The base name of the plugin directory
	 */
	define( 'RT_TRANSCODER_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_VERSION' ) ) {
	/**
	 * The version of the plugin
	 */
	define( 'RT_TRANSCODER_VERSION', '1.3.6' );
}

if ( ! defined( 'RT_TRANSCODER_NO_MAIL' ) && defined( 'VIP_GO_APP_ENVIRONMENT' ) ) {
	define( 'RT_TRANSCODER_NO_MAIL', true );
}

require_once RT_TRANSCODER_PATH . 'inc/helpers/autoloader.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'inc/helpers/custom-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'admin/rt-transcoder-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'admin/rt-transcoder-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

global $rt_transcoder_admin;

/**
 * Initiate file system.
 */
\Transcoder\Inc\FileSystem::get_instance();

$rt_transcoder_admin = new RT_Transcoder_Admin();

/**
 * Initiate blocks.
 */
\Transcoder\Inc\Plugin::get_instance();

/**
 * Add Settings/Docs link to plugins area.
 *
 * @since 1.1.2
 *
 * @param array  $links Links array in which we would prepend our link.
 * @param string $file Current plugin basename.
 *
 * @return array Processed links.
 */
function rtt_action_links( $links, $file ) {
	// Return normal links if not plugin.
	if ( plugin_basename( 'transcoder/rt-transcoder.php' ) !== $file ) {
		return $links;
	}

	// Add a few links to the existing links array.
	$settings_url = sprintf(
		'<a href="%1$s">%2$s</a>',
		esc_url( admin_url( 'admin.php?page=rt-transcoder' ) ),
		esc_html__( 'Settings', 'transcoder' )
	);

	$docs_url = sprintf(
		'<a target="_blank" href="https://rtmedia.io/docs/transcoder/">%1$s</a>',
		esc_html__( 'Docs', 'transcoder' )
	);

	return array_merge(
		$links,
		array(
			'settings' => $settings_url,
			'docs'     => $docs_url,
		)
	);
}

add_filter('plugin_action_links', 'rtt_action_links', 11, 2);
add_filter('network_admin_plugin_action_links', 'rtt_action_links', 11, 2);

add_action('admin_head', 'inject_media_library_react_root');
function inject_media_library_react_root()
{
	?>
	<script type="text/javascript">
		document.addEventListener('DOMContentLoaded', function() {
			var mediaLibraryRoot = document.createElement('div');
			mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
			const wpbody = document.querySelector('#wpbody');
			wpbody.insertBefore(mediaLibraryRoot, wpbody.firstChild);
		});
	</script>
	<?php
}

// Register a taxonomy called 'Media Folders' for the attachment post type.
function register_media_folders_taxonomy()
{
	// Arguments for the taxonomy.
	$args = array(
		'labels' => array(
			'name'              => _x('Media Folders', 'taxonomy general name', 'text-domain'),
			'singular_name'     => _x('Media Folder', 'taxonomy singular name', 'text-domain'),
			'search_items'      => __('Search Media Folders', 'text-domain'),
			'all_items'         => __('All Media Folders', 'text-domain'),
			'parent_item'       => __('Parent Folder', 'text-domain'),
			'parent_item_colon' => __('Parent Folder:', 'text-domain'),
			'edit_item'         => __('Edit Media Folder', 'text-domain'),
			'update_item'       => __('Update Media Folder', 'text-domain'),
			'add_new_item'      => __('Add New Media Folder', 'text-domain'),
			'new_item_name'     => __('New Media Folder Name', 'text-domain'),
			'menu_name'         => __('Media Folders', 'text-domain'),
		),
		'hierarchical'      => true, // Enables folder hierarchy.
		'show_ui'           => true, // Show the taxonomy UI in the admin.
		'show_admin_column' => true, // Display taxonomy in the admin list table.
		'query_var'         => true, // Enable taxonomy querying.
		'rewrite'           => array('slug' => 'media-folder'), // Set the URL slug for folders.
		'show_in_rest'      => true, // Enable the taxonomy in the REST API.
		'query_var'         => true,
	);

	// Register the taxonomy and associate it with the attachment post type.
	register_taxonomy('media-folder', array('attachment'), $args);
}
add_action('init', 'register_media_folders_taxonomy');

add_action( 'rest_api_init', function () {
    register_rest_route( 'media-folders/v1', '/assign-folder', array(
        'methods'             => 'POST',
        'callback'            => 'assign_images_to_folder',
        'permission_callback' => function () {
            return current_user_can( 'edit_posts' ); // Adjust capability as needed
        },
        'args'                => array(
            'attachment_ids' => array(
                'required' => true,
                'type'     => 'array',
                'items'    => array( 'type' => 'integer' ),
                'description' => 'Array of attachment IDs to associate.',
            ),
            'folder_term_id' => array(
                'required' => true,
                'type'     => 'integer',
                'description' => 'ID of the folder term to associate with the attachments.',
            ),
        ),
    ) );
} );

function assign_images_to_folder( WP_REST_Request $request ) {
    $attachment_ids = $request->get_param( 'attachment_ids' );
    $folder_term_id = $request->get_param( 'folder_term_id' );

    // Validate folder term ID
    $term = get_term( $folder_term_id, 'media-folder' ); // Replace 'media_folders' with your taxonomy name
    if ( ! $term || is_wp_error( $term ) ) {
        return new WP_Error( 'invalid_term', 'Invalid folder term ID.', array( 'status' => 400 ) );
    }

    // Validate attachment IDs and update terms
    foreach ( $attachment_ids as $attachment_id ) {
        if ( get_post_type( $attachment_id ) !== 'attachment' ) {
            return new WP_Error( 'invalid_attachment', 'Invalid attachment ID.', array( 'status' => 400 ) );
        }

        $return = wp_set_object_terms( $attachment_id, $folder_term_id, 'media-folder' );

		if ( is_wp_error( $return ) ) {
			return new WP_Error( 'term_assignment_failed', 'Failed to associate attachments with the folder.', array( 'status' => 500 ) );
		}
    }

    return rest_ensure_response( array(
        'success' => true,
        'message' => 'Attachments successfully associated with the folder.',
    ) );
}

add_filter( 'ajax_query_attachments_args', 'filter_media_library_by_taxonomy' );

function filter_media_library_by_taxonomy( $query_args ) {

	// var_dump( $query_args );
	// die;

    // Check if the 'media-folder' parameter is set in the query arguments
    if ( isset( $_REQUEST['query']['media-folder'] ) && ! empty( $_REQUEST['query']['media-folder'] ) ) {
        // Sanitize the taxonomy term ID
        $media_folder_id = intval( $_REQUEST['query']['media-folder'] );

        // Add the taxonomy query to the query arguments
        $query_args['tax_query'] = array(
            array(
                'taxonomy' => 'media-folder', // Replace with your taxonomy slug
                'field'    => 'term_id', // Use term_id for filtering by term ID
                'terms'    => $media_folder_id,
            ),
        );

		// Unset the 'media-folder' parameter to prevent it from being used in the main query
		unset( $query_args['media-folder'] );
    }

    return $query_args;
}



// add_action( 'init', 'test_query' );

function test_query() {
	$args = array(
		'orderby'        => 'date',
		'order'          => 'DESC',
		'posts_per_page' => 80,
		'paged'          => 1,
		'post_type'      => 'attachment',
		'post_status'    => array( 'inherit', 'private' ),
		'media-folder'   => 'pacciformes', // Replace with the desired term slug
	);

	$args = array(
		'orderby'        => 'date',
		'order'          => 'DESC',
		'posts_per_page' => 80,
		'paged'          => 1,
		'post_type'      => 'attachment',
		'post_status'    => array( 'inherit', 'private' ),
		'tax_query'      => array( // This must be an array of arrays
			array(
				'taxonomy' => 'media-folder',
				'field'    => 'term_id', // Use 'slug' if passing the term slug
				'terms'    => 10, // Replace with the desired term slug
			),
		),
	);

	$args = array(
		'orderby'        => 'date',
		'order'          => 'DESC',
		'posts_per_page' => 80,
		'paged'          => 1,
		'post_type'      => 'attachment',
		'post_status'    => array( 'inherit', 'private' ),
		'tax_query'      => array(
			array(
				'taxonomy' => 'media-folder',
				'field'    => 'term_id', // Using 'term_id' for the taxonomy query
				'terms'    => 10,        // Replace with the desired term ID
			),
		),
	);
	
	// // Create a new WP_Query instance
	$query = new WP_Query( $args );
	
	var_dump( $query->posts );
	die;
	
}
