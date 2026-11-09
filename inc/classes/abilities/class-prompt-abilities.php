<?php
/**
 * MCP prompts for GoDAM's main workflows.
 *
 * A prompt is a ready-made instruction an MCP client offers its user, such as
 * a slash command. Each one tells the agent which GoDAM tools to call and in
 * what order, so a common job takes one pick instead of a long explanation.
 * Prompts only return text; the tools they name still check the user's
 * permissions on every call.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Prompt_Abilities
 *
 * @since n.e.x.t
 */
class Prompt_Abilities extends Ability_Group {

	/**
	 * Registers this group's prompts.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add_prompt(
			'godam/prompt-add-video-to-page',
			__( 'Add a video to a page', 'godam' ),
			__( 'Put a GoDAM video on a page, with chapters and a call to action.', 'godam' ),
			array(
				'video' => __( 'The video: its media ID, or words from its title.', 'godam' ),
				'page'  => __( 'The page: its ID or title. Leave empty to create a new draft page.', 'godam' ),
				'cta'   => __( 'Optional. What the call to action should say and where its button should link.', 'godam' ),
			),
			array( $this, 'add_video_to_page_prompt' )
		);

		$this->add_prompt(
			'godam/prompt-organise-library',
			__( 'Organise the media library', 'godam' ),
			__( 'Sort media that is not in a folder into folders, and fix missing titles.', 'godam' ),
			array(
				'scope' => __( 'Optional. Which media to look at, for example "videos uploaded this month".', 'godam' ),
			),
			array( $this, 'organise_library_prompt' )
		);

		$this->add_prompt(
			'godam/prompt-video-report',
			__( 'Video performance report', 'godam' ),
			__( 'Summarise how the site\'s videos are doing. Analytics need a GoDAM plan.', 'godam' ),
			array(
				'period' => __( 'Optional. The dates to cover, for example "last 30 days". All time when empty.', 'godam' ),
			),
			array( $this, 'video_report_prompt' )
		);
	}

	/**
	 * Registers one prompt.
	 *
	 * Prompt arguments are always strings in MCP, so each becomes an optional
	 * string property of the input schema.
	 *
	 * @since n.e.x.t
	 *
	 * @param string   $name        Ability name.
	 * @param string   $label       Label.
	 * @param string   $description Description.
	 * @param string[] $arguments   Argument names and their descriptions.
	 * @param callable $callback    Returns the prompt text.
	 *
	 * @return void
	 */
	private function add_prompt( $name, $label, $description, array $arguments, $callback ) {
		$properties = array();

		foreach ( $arguments as $argument => $argument_description ) {
			$properties[ $argument ] = array(
				'type'        => 'string',
				'description' => $argument_description,
			);
		}

		$this->add(
			$name,
			array(
				'label'               => $label,
				'description'         => $description,
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => $properties,
				),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => function ( $input = array() ) use ( $callback ) {
					return array( 'text' => call_user_func( $callback, (array) $input ) );
				},
				'permission_callback' => array( $this, 'can_use_prompts' ),
				'meta'                => array(
					'mcp' => array( 'type' => 'prompt' ),
				),
			)
		);
	}

	/**
	 * Permission: the same capability as connecting to the GoDAM MCP server.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_use_prompts() {
		return current_user_can( Mcp_Server::TRANSPORT_CAPABILITY );
	}

	/**
	 * Text of godam/prompt-add-video-to-page.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Prompt arguments.
	 *
	 * @return string
	 */
	public function add_video_to_page_prompt( array $input ) {
		$lines = array(
			/* translators: %s: the video the user named. */
			sprintf( __( 'Add the GoDAM video "%s" to a page.', 'godam' ), $input['video'] ?? '' ),
			! empty( $input['page'] )
				/* translators: %s: the page the user named. */
				? sprintf( __( 'Page: "%s". Find it first and keep its current status.', 'godam' ), $input['page'] )
				: __( 'Create a new draft page for it.', 'godam' ),
			__( '1. Find the video with godam/list-media (search by title) unless a media ID was given, and check it with godam/get-media.', 'godam' ),
			__( '2. If it has a transcript (godam/get-transcript), propose chapters from it and save them with godam/set-chapters after I agree.', 'godam' ),
		);

		if ( ! empty( $input['cta'] ) ) {
			/* translators: %s: what the call to action should say. */
			$lines[] = sprintf( __( '3. Add a cta layer with godam/add-layer near the end of the video: %s', 'godam' ), $input['cta'] );
		}

		$lines[] = __( 'Then place it with godam/add-media-to-page. Do not pass status for an existing page. Show me the page link when done.', 'godam' );

		return implode( "\n", $lines );
	}

	/**
	 * Text of godam/prompt-organise-library.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Prompt arguments.
	 *
	 * @return string
	 */
	public function organise_library_prompt( array $input ) {
		$scope = ! empty( $input['scope'] ) ? $input['scope'] : __( 'all media', 'godam' );

		return implode(
			"\n",
			array(
				/* translators: %s: which media to look at. */
				sprintf( __( 'Help me organise the GoDAM library: %s.', 'godam' ), $scope ),
				__( '1. List the folders with godam/list-folders and the media with godam/list-media.', 'godam' ),
				__( '2. Propose a folder for each item that has none, and better titles for items with file-name titles. Show me the plan as a table and wait for my yes.', 'godam' ),
				__( '3. Then create missing folders with godam/create-folder, move items with godam/move-media-to-folder and fix titles with godam/update-media-details.', 'godam' ),
				__( 'Never delete anything.', 'godam' ),
			)
		);
	}

	/**
	 * Text of godam/prompt-video-report.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Prompt arguments.
	 *
	 * @return string
	 */
	public function video_report_prompt( array $input ) {
		$period = ! empty( $input['period'] ) ? $input['period'] : __( 'all time', 'godam' );

		return implode(
			"\n",
			array(
				/* translators: %s: the dates to cover. */
				sprintf( __( 'Write a short report on how the site\'s videos are doing, for %s.', 'godam' ), $period ),
				__( '1. Get the top videos with godam/get-top-videos, then godam/get-media-analytics for the top three.', 'godam' ),
				__( '2. For videos with layers, add godam/get-layer-analytics.', 'godam' ),
				__( '3. Give the three numbers that matter most, what changed, and one suggestion per video.', 'godam' ),
				__( 'If a tool says it needs a GoDAM plan, tell me that instead of guessing numbers.', 'godam' ),
			)
		);
	}
}
