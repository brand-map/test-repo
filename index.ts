import http from "http";

const server = http.createServer((req, res) => {
	// Only handle SSE endpoint
	if (req.url === "/events") {
		// SSE headers
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
		});

		let progress = 0;

		function sendShit(ms: number) {
			progress++;

			// Send SSE "progress" event
			res.write(`event: progress\n`);
			res.write(`data: ${progress}\n\n`);

			if (progress >= 100) {
				clearInterval(interval);

				// Optional: tell client it's done
				res.write(`event: done\ndata: complete\n\n`);

				// Close the SSE stream
				res.end();
			}
		}

		const interval = setInterval(() => {
			progress++;

			// Send SSE "progress" event
			res.write(`event: progress\n`);
			res.write(`data: ${progress}\n\n`);

			if (progress >= 100) {
				clearInterval(interval);

				// Optional: tell client it's done
				res.write(`event: done\ndata: complete\n\n`);

				// Close the SSE stream
				res.end();
			}
		}, 100);

		return;
	}

	res.writeHead(404);
	res.end("Not found");
});

server.listen(3000, () => {
	console.log("SSE server running on http://localhost:3000");
});

// Client

// const eventSource = new EventSource('http://localhost:3000/events'); // Replace with your SSE endpoint URL

(function listenOnClient() {
	const log = (msg) => {
		console.log(msg);
		console.dir(msg);
	};

	const es = new EventSource("http://localhost:3000/events");

	es.addEventListener("progress", (event) => {
		log("Progress: " + event.data + "%");
	});

	es.addEventListener("done", () => {
		log("Finished!");
		es.close();
	});

	es.onerror = () => {
		log("SSE connection closed.");
	};
})();
