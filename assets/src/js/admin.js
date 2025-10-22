/* global godamAdminNotices */

/**
 * Write your JS code here for admin.
 */

// Utility function to join URL paths
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
 * Manages the particle effect background
 */
class ParticleEffect {
	constructor() {
		// Initialize canvas and context
		this.canvas = document.getElementById( 'godam-particle-canvas' );
		this.banner = document.querySelector( '.annual-plan-offer-banner' );

		// Bail if canvas and banner do not exist
		if ( ! this.canvas || ! this.banner ) {
			return;
		}

		this.ctx = this.canvas.getContext( '2d' );
		this.particles = [];
		this.setupEventListeners();
		this.resizeCanvas();
		this.animate();
	}

	// Set up event listeners for resizing the canvas
	setupEventListeners() {
		window.addEventListener( 'resize', this.debounce( () => this.resizeCanvas(), 100 ) );
	}

	// Debounce function to limit the rate of function execution
	debounce( fn, delay ) {
		let timer;
		return function() {
			clearTimeout( timer );
			timer = setTimeout( fn, delay );
		};
	}

	// Resize the canvas to fit the banner
	resizeCanvas() {
		this.width = this.canvas.width = this.banner.offsetWidth || window.innerWidth;
		this.height = this.canvas.height = this.banner.offsetHeight || 300;
		this.initParticles( 40 );
	}

	// Initialize particles based on the canvas size
	initParticles( count ) {
		const maxParticles = Math.min( count, Math.floor( this.width / 20 ) );
		this.particles = Array.from( { length: maxParticles }, () => new Particle( this.ctx, this.width, this.height ) );
	}

	// Start the animation loop
	animate() {
		// Bail if canvas and context do not exist
		if ( ! this.canvas || ! this.ctx ) {
			return;
		}

		this.ctx.clearRect( 0, 0, this.width, this.height );
		this.particles.forEach( ( p ) => {
			p.update();
			p.draw();
		} );
		requestAnimationFrame( () => this.animate() );
	}
}

/**
 * Handle dismissal of admin notices
 */
function initAdminNotices() {
	// Handle upload limits notice dismissal
	document.addEventListener( 'click', function( e ) {
		// Check if the clicked element is our custom dismiss button
		if ( e.target.closest( '.godam-upload-limits-notice .godam-dismiss-btn' ) ) {
			e.preventDefault();

			const notice = e.target.closest( '.godam-upload-limits-notice' );

			// Hide the notice immediately
			notice.style.display = 'none';

			// Send AJAX request to dismiss notice (fire and forget)
			const formData = new FormData();
			formData.append( 'action', 'godam_dismiss_upload_limits_notice' );
			formData.append( 'nonce', godamAdminNotices.nonce );

			fetch( godamAdminNotices.ajaxUrl, {
				method: 'POST',
				body: formData,
			} );
		}
	} );
}

function initAdminUI() {
	initTogglePostboxes();
	new ParticleEffect();
	initAdminNotices();
}

document.addEventListener( 'DOMContentLoaded', initAdminUI );
