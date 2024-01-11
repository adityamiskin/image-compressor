import React, { useState } from 'react';
import imageCompression from 'browser-image-compression';
import Setting from '../components/Setting';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const Compress = () => {
	const [selectedFiles, setSelectedFiles] = useState([]);
	const [quality, setQuality] = useState(80);
	const [maxSize, setMaxSize] = useState(2);
	const [maxWidth, setMaxWidth] = useState(4096); // Added maxWidth state
	const [maxHeight, setMaxHeight] = useState(4096); // Added maxHeight state
	const [removeMetadata, setRemoveMetadata] = useState(false);
	const [progress, setProgress] = useState(0);
	const [savings, setSavings] = useState([]);

	const handleFileChange = (event) => {
		const files = Array.from(event.target.files);
		setSelectedFiles(files);
	};

	const [compressedImage, setCompressedImage] = useState(null);

	const compressImages = async () => {
		const zip = new JSZip();
		let completedFiles = 0;
		for (const file of selectedFiles) {
			const originalSize = file.size / 1024 / 1024; // size in MB

			const options = {
				maxSizeMB: { maxSize },
				maxWidthOrHeight: Math.max(maxWidth, maxHeight), // Set the maximum width or height based on the larger value
				initialQuality: quality / 100,
				preserveExif: !removeMetadata,
				useWebWorker: true,
				onProgress: undefined,
			};

			console.log(options);

			try {
				const compressedFile = await imageCompression(file, options);
				setCompressedImage(compressedFile);

				completedFiles += 1;
				setProgress((completedFiles / selectedFiles.length) * 100);

				const compressedSize = compressedFile.size / 1024 / 1024; // size in MB

				const savings = originalSize - compressedSize;
				const savingsPercentage =
					((originalSize - compressedSize) / originalSize) * 100;
				setSavings([savings, savingsPercentage]);

				// Add the compressed file to the zip
				const compressedBlob = await compressedFile.arrayBuffer();
				zip.file(
					`${file.name}_compressed.${file.type.split('/')[1]}`,
					compressedBlob,
				);
			} catch (error) {
				console.error('Image compression failed:', error);
			}
		}

		// Generate the zip file and download it
		zip.generateAsync({ type: 'blob' }).then((content) => {
			saveAs(content, 'compressed_images.zip');
		});
	};

	const handleDrop = (event) => {
		event.preventDefault();
		const files = Array.from(event.dataTransfer.files);
		setSelectedFiles(files);
	};

	const handleDragOver = (event) => {
		event.preventDefault();
	};

	const resetStates = () => {
		setSelectedFiles([]);
		setQuality(80);
		setMaxSize(2);
		setMaxWidth(4096);
		setMaxHeight(4096);
		setRemoveMetadata(false);
		setProgress(0);
		setSavings([]);
		setCompressedImage(null);
	};

	return (
		<div className='w-full flex justify-center items-center flex-col mb-24 px-8 max-w-6xl mx-auto'>
			<h1 className='py-8'>Bulk Compress Images</h1>

			{selectedFiles.length === 0 && (
				<div className='w-full flex justify-center items-center flex-col'>
					<div
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						className='border border-dashed p-8 rounded mb-8 w-full bg-gray-600'>
						<div>
							<p className='mb-2'>Drag and drop files here</p>
							<p className='mb-2'>OR</p>
							<input
								type='file'
								multiple
								onChange={handleFileChange}
								className='hidden'
								accept='image/png, image/jpeg, image/webp, image/tiff'
							/>
							<button
								onClick={() =>
									document.querySelector('input[type=file]').click()
								}>
								Select Files
							</button>
						</div>
					</div>

					<div className='flex justify-around'>
						<div className='text-left text-2xl font-light flex-1 flex flex-col gap-4 h-full'>
							<p>Bulk Image Compressor</p>
							<p className='text-lg'>Fast batch image compressor</p>
							<ol style={{ listStyleType: 'number' }} className='text-lg'>
								<li>Compress images in bulk</li>
								<li>Drag n Drop images</li>
							</ol>
						</div>
						<div className='text-left flex-1 text-2xl font-light flex flex-col gap-4 h-full'>
							<p>No uploading. No signup.</p>
							<p>Reduce size of images in bulk.</p>
							<p className='text-lg'>
								Compress unlimited images online. Your photos are your property
								and stay on your machine.
							</p>
						</div>
					</div>

					<hr className='my-32 h-1 w-3/4' />

					<h2 className='text-4xl font-semibold mb-4'>
						Frequently Asked Questions
					</h2>
					<div className='mt-8 grid grid-cols-2 gap-16'>
						<div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									1. How does the image compression work?
								</h3>
								<p className='text-base'>
									The image compression algorithm used in this project reduces
									the file size of the selected images while maintaining an
									acceptable level of quality. It achieves this by removing
									unnecessary data and optimizing the image's encoding.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									2. Can I compress multiple images at once?
								</h3>
								<p className='text-base'>
									Yes, you can compress multiple images at once. Simply drag and
									drop the images into the designated area or select them using
									the "Select Files" button. The project will compress all the
									selected images in bulk.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									3. Can I specify the maximum width and height of the
									compressed images?
								</h3>
								<p className='text-base'>
									Yes, you can specify the maximum width and height of the
									compressed images. This allows you to control the dimensions
									of the images while reducing their file size.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									4. Can I do lossless compression with this tool?
								</h3>
								<p className='text-base'>
									The algorithm is not lossless but you can select 95%+ quality
									to get near lossless results.
								</p>
							</div>
						</div>
						<div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									5. Are my images uploaded to a server?
								</h3>
								<p className='text-base'>
									No, this project does not upload your images to any server.
									The compression process happens locally on your machine,
									ensuring that your photos remain private and secure.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									6. What are the advanced settings?
								</h3>
								<p className='text-base'>
									The advanced settings allow you to customize the compression
									process. You can adjust the quality level, set a maximum file
									size, and choose whether to remove metadata from the images.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									7. Can I undo the compression process?
								</h3>
								<p className='text-base'>
									No, the compression process is irreversible. It is recommended
									to keep a backup of your original images before compressing
									them.
								</p>
							</div>
							<div className='mb-8'>
								<h3 className='text-lg font-medium mb-2'>
									8. Why was this image compressor created in 2023?
								</h3>
								<p className='text-base'>
									Existing image compressors are ad laden, upload images to
									server and have limits on number of images that can be
									compressed. So, this tool was created to provide a better user
									experience.
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{selectedFiles.length > 0 && progress === 0 && (
				<div className='mb-8 w-3/4'>
					<p className='mb-4 text-xl'>
						Number of Images Selected: {selectedFiles.length}
					</p>
					<button
						onClick={compressImages}
						className='text-3xl mb-4 bg-orange-400 text-black font-normal'>
						Start Compression <br />
						<span className='text-sm'>
							(Quality: {quality}%, Max Size: {maxSize}
							MB, Remove Metadata: {removeMetadata ? 'Yes' : 'No'})
						</span>
					</button>
					<div>
						<p className='mb-4 text-xl'>Advanced Settings:</p>
						<Setting
							label='Quality'
							type='range'
							id='quality'
							name='quality'
							min='0'
							max='100'
							value={quality}
							onChange={(event) => setQuality(event.target.value)}
							unit='%'
						/>

						<Setting
							label='Max Size'
							type='range'
							id='maxSize'
							name='maxSize'
							min='0.01'
							max='5'
							step='0.01'
							value={maxSize}
							onChange={(event) => setMaxSize(event.target.value)}
							unit='MB'
						/>

						<div className='flex justify-center gap-4'>
							<Setting
								label='Max Width'
								type='number'
								id='maxWidth'
								name='maxWidth'
								min='0'
								value={maxWidth}
								onChange={(event) => setMaxWidth(event.target.value)}
								unit='px'
							/>

							<Setting
								label='Max Height'
								type='number'
								id='maxHeight'
								name='maxHeight'
								min='0'
								value={maxHeight}
								onChange={(event) => setMaxHeight(event.target.value)}
								unit='px'
							/>
						</div>

						<div className='mb-2'>
							<label htmlFor='removeMetadata' className='mr-2'>
								Remove Metadata:
							</label>
							<select
								id='removeMetadata'
								name='removeMetadata'
								value={removeMetadata}
								onChange={(event) =>
									setRemoveMetadata(event.target.value === 'true')
								}
								className='p-2 px-4 text-white rounded-md border-0ring-1 ring-inset ring-gray-30 focus:ring-2 focus:ring-inset focus:ring-indigo-600'>
								<option value='false'>No</option>
								<option value='true'>Yes</option>
							</select>
						</div>
					</div>
				</div>
			)}

			{progress > 0 && progress < 100 && (
				<div class='w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 px-6'>
					<div
						class='bg-blue-600 h-2.5 rounded-full'
						style={{ width: `${progress}%` }}></div>
				</div>
			)}

			{compressedImage && progress === 100 && (
				<div>
					<p className='text-4xl mb-8'>Done ✅</p>

					<button className='mb-8' onClick={resetStates}>
						Compress More Images!
					</button>

					<div className='rounded border p-8 mb-8'>
						<span className='text-3xl'>
							Saved <span className='text-6xl'>{savings[1].toFixed(1)}%</span>
							<span className='text-sm ml-4'>
								{savings[0].toFixed(2)} MB&nbsp;reduced
							</span>
						</span>
					</div>

					<div>
						<p className='mb-4'>
							It takes time and money for development and server costs for this
							app.
						</p>
						<p className='text-xl'>
							If you like it, &nbsp;
							<a
								href='https://buy.stripe.com/test_8wM6r12tt2RffXq7ss'
								className='underline'>
								please consider one time purchase of $10. Use forever!
							</a>
						</p>
					</div>
				</div>
			)}
		</div>
	);
};

export default Compress;
