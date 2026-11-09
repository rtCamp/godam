<?php
/**
 * Abilities that list what a form or poll layer can show.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Hubspot;
use RTGODAM\Inc\Marketo;

/**
 * Class Form_Abilities
 *
 * The video editor lists forms through one REST route per form plugin, and
 * offers a plugin only when it is active. These abilities do the same, so an
 * agent picks from exactly the forms the editor would offer and gets back the
 * plugin key and form ID godam/add-layer expects.
 *
 * @since n.e.x.t
 */
class Form_Abilities extends Ability_Group {

	/**
	 * Where each form plugin's forms are listed, keyed like
	 * Layer_Abilities::FORM_PLUGINS. `plugin` is the file the video editor checks
	 * to offer the plugin; HubSpot and Marketo are services, offered when GoDAM
	 * is connected to them. Contact Form 7 is listed through its own REST route,
	 * as in the editor.
	 *
	 * @since n.e.x.t
	 *
	 * @var array<string, array{route: string, plugin: string[]}>
	 */
	const SOURCES = array(
		'gravity'      => array(
			'route'  => '/godam/v1/gforms',
			'plugin' => array( 'gravityforms/gravityforms.php' ),
		),
		'cf7'          => array(
			'route'  => '/contact-form-7/v1/contact-forms',
			'plugin' => array( 'contact-form-7/wp-contact-form-7.php' ),
		),
		'wpforms'      => array(
			'route'  => '/godam/v1/wpforms',
			'plugin' => array( 'wpforms-lite/wpforms.php', 'wpforms/wpforms.php' ),
		),
		'sureforms'    => array(
			'route'  => '/godam/v1/sureforms',
			'plugin' => array( 'sureforms/sureforms.php' ),
		),
		'forminator'   => array(
			'route'  => '/godam/v1/forminator-forms',
			'plugin' => array( 'forminator/forminator.php' ),
		),
		'fluentforms'  => array(
			'route'  => '/godam/v1/fluent-forms',
			'plugin' => array( 'fluentform/fluentform.php' ),
		),
		'everestforms' => array(
			'route'  => '/godam/v1/everest-forms',
			'plugin' => array( 'everest-forms/everest-forms.php' ),
		),
		'ninjaforms'   => array(
			'route'  => '/godam/v1/ninja-forms',
			'plugin' => array( 'ninja-forms/ninja-forms.php' ),
		),
		'metform'      => array(
			'route'  => '/godam/v1/metforms',
			'plugin' => array( 'metform/metform.php' ),
		),
		'hubspot'      => array(
			'route'  => '/godam/v1/hubspot-forms',
			'plugin' => array(),
		),
		'marketo'      => array(
			'route'  => '/godam/v1/marketo/forms',
			'plugin' => array(),
		),
	);

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/list-forms',
			array(
				'label'               => __( 'List forms for form layers', 'godam' ),
				'description'         => __( 'List the forms a form layer can show, from every form plugin the video editor supports that is active on this site. Pass a form\'s plugin and form_id to godam/add-layer as form.plugin and form.form_id.', 'godam' ),
				'category'            => 'godam-player',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'plugin' => array(
							'type'        => 'string',
							'enum'        => array_keys( self::SOURCES ),
							'description' => __( 'Only list forms from this plugin.', 'godam' ),
						),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'count'            => array( 'type' => 'integer' ),
						'forms'            => array(
							'type'  => 'array',
							'items' => array(
								'type'       => 'object',
								'properties' => array(
									'plugin'  => array( 'type' => 'string' ),
									'form_id' => array( 'type' => array( 'string', 'integer' ) ),
									'title'   => array( 'type' => 'string' ),
								),
							),
						),
						'active_plugins'   => array(
							'type'  => 'array',
							'items' => array( 'type' => 'string' ),
						),
						'unlisted_plugins' => array(
							'type'        => 'object',
							'description' => 'Active plugins whose forms could not be listed, with the reason.',
						),
					),
				),
				'execute_callback'    => array( $this, 'list_forms' ),
				'permission_callback' => array( $this, 'can_use_media_editor' ),
			)
		);

		$this->add(
			'godam/list-polls',
			array(
				'label'               => __( 'List polls for poll layers', 'godam' ),
				'description'         => __( 'List the WP-Polls polls a poll layer can show, newest first. Pass a poll\'s id to godam/add-layer as poll.poll_id.', 'godam' ),
				'category'            => 'godam-player',
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array(
						'count' => array( 'type' => 'integer' ),
						'polls' => array(
							'type'  => 'array',
							'items' => array( 'type' => 'object' ),
						),
					),
				),
				'execute_callback'    => array( $this, 'list_polls' ),
				'permission_callback' => array( $this, 'can_use_media_editor' ),
			)
		);
	}

	/**
	 * Permission: the user can open the media editor, which lists these.
	 *
	 * Matches the form routes' own check.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_use_media_editor() {
		return current_user_can( 'upload_files' );
	}

	/**
	 * Executes godam/list-forms.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function list_forms( $input = array() ) {
		$only = (string) ( $input['plugin'] ?? '' );

		$forms    = array();
		$active   = array();
		$unlisted = array();

		foreach ( self::SOURCES as $plugin => $source ) {
			if ( ( '' !== $only && $plugin !== $only ) || ! $this->is_source_active( $plugin, $source ) ) {
				continue;
			}

			$active[] = $plugin;
			$listed   = $this->rest( 'GET', $source['route'] );

			if ( is_wp_error( $listed ) ) {
				$unlisted[ $plugin ] = $listed->get_error_message();
				continue;
			}

			foreach ( (array) $listed as $form ) {
				$form = (array) $form;

				if ( ! isset( $form['id'] ) || '' === (string) $form['id'] ) {
					continue;
				}

				$forms[] = array(
					'plugin'  => $plugin,
					'form_id' => $form['id'],
					// Forminator names its forms; every other source titles them.
					'title'   => (string) ( $form['title'] ?? ( $form['name'] ?? '' ) ),
				);
			}
		}

		if ( '' !== $only && empty( $active ) ) {
			return new \WP_Error(
				'rtgodam_form_plugin_inactive',
				/* translators: %s: form plugin key. */
				sprintf( __( 'The %s form plugin is not active on this site. Call godam/list-forms without a plugin to see what is available.', 'godam' ), $only ),
				array( 'status' => 404 )
			);
		}

		$result = array(
			'count'            => count( $forms ),
			'forms'            => $forms,
			'active_plugins'   => $active,
			'unlisted_plugins' => (object) $unlisted,
		);

		if ( empty( $active ) ) {
			$result['hint'] = __( 'No supported form plugin is active, so no form layer can be added. Supported: Gravity Forms, Contact Form 7, WPForms, SureForms, Forminator, Fluent Forms, Everest Forms, Ninja Forms, MetForm, HubSpot and Marketo.', 'godam' );
		}

		return $result;
	}

	/**
	 * Executes godam/list-polls.
	 *
	 * @since n.e.x.t
	 *
	 * @return array|\WP_Error
	 */
	public function list_polls() {
		$listed = $this->rest( 'GET', '/godam/v1/polls' );

		if ( is_wp_error( $listed ) ) {
			return new \WP_Error(
				$listed->get_error_code(),
				__( 'Poll layers need the WP-Polls plugin, which is not active on this site.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		$polls = array();

		foreach ( (array) $listed as $poll ) {
			$poll = (array) $poll;

			$polls[] = array(
				'id'           => (int) $poll['pollq_id'],
				'question'     => wp_specialchars_decode( (string) $poll['pollq_question'], ENT_QUOTES ),
				'open'         => '1' === (string) $poll['pollq_active'],
				'total_votes'  => (int) $poll['pollq_totalvotes'],
				'multi_answer' => (bool) $poll['pollq_multiple'],
			);
		}

		return array(
			'count' => count( $polls ),
			'polls' => $polls,
		);
	}

	/**
	 * Whether the video editor would offer this form source.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $plugin Source key.
	 * @param array  $source Source definition from SOURCES.
	 *
	 * @return bool
	 */
	private function is_source_active( $plugin, array $source ) {
		if ( 'hubspot' === $plugin ) {
			return Hubspot::is_configured();
		}

		if ( 'marketo' === $plugin ) {
			return Marketo::is_configured();
		}

		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		foreach ( $source['plugin'] as $file ) {
			if ( is_plugin_active( $file ) ) {
				return true;
			}
		}

		return false;
	}
}
