/* global Swiper */
const { addFilter } = wp.hooks;

document.addEventListener( 'DOMContentLoaded', () => {
	const swiper = new Swiper( '.swiper', {
		loop: true,
		pagination: {
			el: '.swiper-pagination',
			clickable: true,
		},
		navigation: {
			nextEl: '.swiper-button-next',
			prevEl: '.swiper-button-prev',
		},
		autoplay: false,
	} );
	addFilter( 'godamvideoplayeraspectratio', 'godam/videoplayer', () => {
		return '9:16';
	} );
} );
