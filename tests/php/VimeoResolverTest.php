<?php
/**
 * Unit tests for resolving a Vimeo URL to its GoDAM video (Vimeo migration, issue #100).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Vimeo_Migration\Vimeo_Resolver;

require_once dirname( __DIR__ ) . '/stubs/vimeo-migration-functions.php';
require_once dirname( __DIR__ ) . '/stubs/class-vimeo-migration-double.php';

/**
 * @covers \RTGODAM\Inc\Vimeo_Migration\Vimeo_Resolver
 */
class VimeoResolverTest extends TestCase {

	/**
	 * @var Vimeo_Migration_Double
	 */
	private $migration;

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array(
			'attachment_url'  => 'https://cdn.example.org/501/video.mp4',
			'title'           => 'Screen Recording',
			'post_meta_by_id' => array(
				501 => array( 'rtgodam_transcoding_job_id' => '3fqjd5bmpr' ),
			),
		);

		$this->migration = ( new \ReflectionClass( Vimeo_Migration_Double::class ) )->newInstanceWithoutConstructor();
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	public function test_resolves_a_vimeo_url_to_the_godam_video() {
		$video = ( new Vimeo_Resolver( $this->migration ) )->resolve( 'https://vimeo.com/1126119215?fl=pl&fe=sh' );

		$this->assertSame(
			array(
				'id'        => 501,
				'url'       => 'https://cdn.example.org/501/video.mp4',
				'title'     => 'Screen Recording',
				'share_url' => RTGODAM_API_BASE . '/web/video/3fqjd5bmpr',
			),
			$video
		);
	}

	public function test_looks_each_video_up_once() {
		$resolver = new Vimeo_Resolver( $this->migration );

		$resolver->resolve( 'https://vimeo.com/1126119215?fl=pl&fe=sh' );
		$resolver->resolve( 'https://player.vimeo.com/video/1126119215' );
		$resolver->resolve( 'https://vimeo.com/76979871' );

		$this->assertSame(
			array( 'https://vimeo.com/1126119215?fl=pl&fe=sh', 'https://vimeo.com/76979871' ),
			$this->migration->lookups
		);
	}

	public function test_returns_null_when_godam_central_has_not_imported_the_video() {
		$this->migration->attachment_id = null;
		$resolver                       = new Vimeo_Resolver( $this->migration );

		$this->assertNull( $resolver->resolve( 'https://vimeo.com/1126119215' ) );
		$this->assertNull( $resolver->resolve( 'https://vimeo.com/1126119215' ) );
		$this->assertCount( 1, $this->migration->lookups, 'A failed lookup is cached too.' );
	}

	public function test_builds_the_share_url() {
		$this->assertSame( RTGODAM_API_BASE . '/web/video/3fqjd5bmpr', Vimeo_Resolver::build_share_url( '3fqjd5bmpr' ) );
		$this->assertSame( '', Vimeo_Resolver::build_share_url( '  ' ) );
	}
}
