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
 * Particle class for canvas-based particle effect
 */
class Particle {
	constructor( ctx, width, height ) {
		this.ctx = ctx;
		this.width = width;
		this.height = height;
		this.x = Math.random() * width;
		this.y = Math.random() * height;
		this.radius = ( Math.random() * 1.5 ) + 1;
		this.vx = ( Math.random() * 0.5 ) - 0.25;
		this.vy = ( Math.random() * 0.5 ) - 0.25;
	}

	// Draw the particle
	draw() {
		this.ctx.beginPath();
		this.ctx.arc( this.x, this.y, this.radius, 0, Math.PI * 2 );
		this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
		this.ctx.fill();
	}

	// Update the particle position
	update() {
		this.x += this.vx;
		this.y += this.vy;

		if ( this.x < 0 || this.x > this.width ) {
			this.vx *= -1;
		}
		if ( this.y < 0 || this.y > this.height ) {
			this.vy *= -1;
		}
	}
}

/**
 * Initialize particle effect background
 */
function initParticleEffect() {
	// Select the banner element and the canvas
	const canvas = document.getElementById( 'godam-particle-canvas' );
	const banner = document.querySelector( '.annual-plan-offer-banner' );

	// Bail out if the canvas is not found
	if ( ! canvas || ! banner ) {
		return;
	}

	// Initialize canvas and context
	const ctx = canvas.getContext( '2d' );
	let width, height;
	let particles = [];

	// Resize canvas to fit the window
	function resizeCanvas() {
		width = canvas.width = banner.offsetWidth || window.innerWidth;
		height = canvas.height = banner.offsetHeight || 300;

		// ReInitialize particles
		initParticles( 40 );
	}

	// Initialize particles
	function initParticles( count ) {
		const maxParticles = Math.min( count, Math.floor( width / 20 ) );
		particles = Array.from( { length: maxParticles }, () => new Particle( ctx, width, height ) );
	}

	// Animate particles
	function animateParticles() {
		ctx.clearRect( 0, 0, width, height );
		particles.forEach( ( p ) => {
			p.update();
			p.draw();
		} );
		requestAnimationFrame( animateParticles );
	}

	// Debounced resize
	function debounce( fn, delay ) {
		let timer;
		return function() {
			clearTimeout( timer );
			timer = setTimeout( fn, delay );
		};
	}

	// Setup
	window.addEventListener( 'resize', debounce( resizeCanvas, 100 ) );
	resizeCanvas();
	animateParticles();
}

function initAdminUI() {
	initTogglePostboxes();
	initParticleEffect();
}

document.addEventListener( 'DOMContentLoaded', initAdminUI );
