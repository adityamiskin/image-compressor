import React from 'react';

const Footer = () => {
	return (
		<footer className='fixed bottom-0 flex gap-4 w-full items-center justify-center p-4 bg-gray-600'>
			<div className='flex justify-around gap-6'>
				{/* <a href='/'>Home</a> */}
				<a href='/'>Compress</a>
				{/* <a href='/resize'>Resize</a> */}
				<a href='/privacy-policy'>Privacy Policy</a>
				<a href='https://forms.google.com/feedback'>Feedback</a>
			</div>
			<p>Made with 💖 by Aditya</p>
		</footer>
	);
};

export default Footer;
