/**
 * Write your JS code here for admin.
 */

window.pathJoin = function( parts, sep = '/' ) {
	return parts
		.map( ( part, index ) => {
			// Don't modify 'http://' or 'https://' at the beginning
			if ( index === 0 ) {
				return part.replace( new RegExp( sep + '+$', 'g' ), '' ); // Remove trailing `/`
			}
			return part.replace( new RegExp( '^' + sep + '+|' + sep + '+$', 'g' ), '' ); // Trim leading and trailing `/`
		} )
		.join( sep );
};

/**
 * Toggle postboxes in admin UI
 */
function initTogglePostboxes() {
	const toggleButtons = document.querySelectorAll( '#easydam-tools-widget .handlediv' );

	toggleButtons.forEach( ( button ) => {
		button.addEventListener( 'click', function() {
			const postbox = button.closest( '.postbox' );
			const inside = postbox.querySelector( '.inside' );

			if ( inside ) {
				const isExpanded = button.getAttribute( 'aria-expanded' ) === 'true';
				inside.style.display = isExpanded ? 'none' : 'block';
				button.setAttribute( 'aria-expanded', ! isExpanded );
			}
		} );
	} );
}

/**
 * Initialize particle effect background
 */
function initParticleEffect() {
	const canvas = document.getElementById( 'particle-canvas' );
	if ( ! canvas ) {
		return;
	}

	const ctx = canvas.getContext( '2d' );
	let width, height;
	let particles = [];

	class Particle {
		constructor() {
			this.x = Math.random() * width;
			this.y = Math.random() * height;
			this.radius = ( Math.random() * 1.5 ) + 1;
			this.vx = ( Math.random() * 0.5 ) - 0.25;
			this.vy = ( Math.random() * 0.5 ) - 0.25;
		}

		draw() {
			ctx.beginPath();
			ctx.arc( this.x, this.y, this.radius, 0, Math.PI * 2 );
			ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
			ctx.fill();
		}

		update() {
			this.x += this.vx;
			this.y += this.vy;

			if ( this.x < 0 || this.x > width ) {
				this.vx *= -1;
			}
			if ( this.y < 0 || this.y > height ) {
				this.vy *= -1;
			}
		}
	}

	function resizeCanvas() {
		width = canvas.width = window.innerWidth;
		height = canvas.height = document.querySelector( '.annual-plan-offer-banner' )?.offsetHeight || 300;
	}

	function initParticles( count ) {
		particles = Array.from( { length: count }, () => new Particle() );
	}

	function animateParticles() {
		ctx.clearRect( 0, 0, width, height );
		particles.forEach( ( p ) => {
			p.update();
			p.draw();
		} );
		requestAnimationFrame( animateParticles );
	}

	// Setup
	window.addEventListener( 'resize', resizeCanvas );
	resizeCanvas();
	initParticles( 40 );
	animateParticles();
}

function initAdminUI() {
	initTogglePostboxes();
	initParticleEffect();
}

document.addEventListener( 'DOMContentLoaded', initAdminUI );
