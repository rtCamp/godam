<?php
/**
 * Unit tests for replacing Vimeo links in ACF fields (Vimeo migration, issue #100).
 *
 * The fixture is the post meta of a real post with an ACF field group:
 * an oEmbed field, a URL field, a Text field, and a Group holding a URL and
 * an oEmbed subfield, each set to a Vimeo link.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Vimeo_Migration\Acf_Source;

require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';

/**
 * @covers \RTGODAM\Inc\Vimeo_Migration\Acf_Source
 */
class VimeoMigrationAcfTest extends TestCase {

	const SHARE_URL = 'https://app.godam.io/web/video/3fqjd5bmpr';

	/**
	 * Field types by field key, as acf_get_field() would report them.
	 *
	 * @var array<string, string>
	 */
	const FIELD_TYPES = array(
		'field_godam_vt_oembed'       => 'oembed',
		'field_godam_vt_url'          => 'url',
		'field_godam_vt_text'         => 'text',
		'field_godam_vt_group'        => 'group',
		'field_godam_vt_group_url'    => 'url',
		'field_godam_vt_group_oembed' => 'oembed',
	);

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array();
		$GLOBALS['rtgodam_hooks'] = array();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		$GLOBALS['rtgodam_hooks'] = array();
		parent::tearDown();
	}

	/**
	 * The stored post meta, as get_post_meta( $post_id ) returns it.
	 *
	 * @return array
	 */
	private function fixture(): array {
		return json_decode( file_get_contents( dirname( __DIR__ ) . '/fixtures/vimeo-migration/acf-post-meta.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- local test fixture.
	}

	/**
	 * Source with a fake resolver and a fake acf_get_field().
	 *
	 * @param array|null $video What the resolver returns.
	 *
	 * @return Acf_Source
	 */
	private function source( $video = array( 'share_url' => self::SHARE_URL ) ): Acf_Source {
		return new Acf_Source(
			static function () use ( $video ) {
				return $video;
			},
			static function ( string $key ) {
				return isset( self::FIELD_TYPES[ $key ] ) ? array(
					'key'  => $key,
					'type' => self::FIELD_TYPES[ $key ],
				) : false;
			}
		);
	}

	/**
	 * Run the migration over meta.
	 *
	 * @param Acf_Source $source Source.
	 * @param array      $meta   Post meta.
	 *
	 * @return array{0: array, 1: array} Updates, counts.
	 */
	private function migrate( Acf_Source $source, array $meta ): array {
		$counts  = array(
			'found'    => 0,
			'migrated' => 0,
		);
		$updates = $source->migrate_meta( $meta, $counts );

		return array( $updates, $counts );
	}

	public function test_replaces_oembed_and_url_fields_including_group_subfields() {
		list( $updates, $counts ) = $this->migrate( $this->source(), $this->fixture() );

		$this->assertSame(
			array(
				'vimeo_oembed'              => self::SHARE_URL,
				'vimeo_url'                 => self::SHARE_URL,
				'vimeo_group_nested_url'    => self::SHARE_URL,
				'vimeo_group_nested_oembed' => self::SHARE_URL,
			),
			$updates,
			'The Text field keeps its Vimeo link.'
		);
		$this->assertSame(
			array(
				'found'    => 4,
				'migrated' => 4,
			),
			$counts
		);
	}

	public function test_keeps_fields_when_the_video_is_not_in_godam_central() {
		list( $updates, $counts ) = $this->migrate( $this->source( null ), $this->fixture() );

		$this->assertSame( array(), $updates );
		$this->assertSame(
			array(
				'found'    => 4,
				'migrated' => 0,
			),
			$counts
		);
	}

	public function test_skips_a_value_with_no_acf_field_reference() {
		list( $updates, $counts ) = $this->migrate(
			$this->source(),
			array( 'some_plugin_video' => array( 'https://vimeo.com/1126119215' ) )
		);

		$this->assertSame( array(), $updates );
		$this->assertSame( 0, $counts['found'] );
	}

	public function test_a_filter_can_add_field_types() {
		add_filter(
			'rtgodam_vimeo_migration_acf_field_types',
			static function ( $types ) {
				$types[] = 'text';
				return $types;
			}
		);

		list( $updates ) = $this->migrate( $this->source(), $this->fixture() );

		$this->assertSame( self::SHARE_URL, $updates['vimeo_text'] );
	}
}
