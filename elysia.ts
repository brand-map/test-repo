import { Elysia, sse } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { cors } from "@elysiajs/cors";
import * as v from "valibot";
import { Valimock } from "valimock";
import { toJsonSchema } from "@valibot/to-json-schema";

const SEND_PRODUCT_INTERVAL = 5_000;

const ProductSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	name: v.string(),
	price: v.number(),
});
const ProductListSchema = v.array(ProductSchema);

const NumSchema = v.pipe(
	v.string(),
	v.transform((val) => Number(val)),
	v.number(),
);

const ProductsListQuerySchema = v.object({
	num: NumSchema,
});

function* genProducts(num: number) {
	const valiMock = new Valimock();

	for (let i = 0; i < num; i++) {
		yield valiMock.mock(ProductSchema);
	}
}

function progresser() {
	let progress = 0;
	return async function sendShit(ms: number): Promise<number> {
		progress += Math.floor(Math.random() * 7);

		return new Promise((res) => setTimeout(() => res(progress), ms));
	};
}

new Elysia()
	.use(
		openapi({
			mapJsonSchema: {
				valibot: toJsonSchema,
			},
		}),
	)
	.model({
		ProductListSchema,
		ProductSchema,
		ProductsListQuerySchema,
		NumSchema,
	})
	.use(
		cors({
			origin: "http://localhost:4000",
			credentials: true,
			allowedHeaders: ["Content-Type", "Authorization"],
		}),
	)
	.get("/", () => "Hello, World!")
	.get(
		"/products",
		(ctx) => {
			return Array.from(genProducts(ctx.query.num));
		},
		{
			query: ProductsListQuerySchema,
			detail: {
				summary: "List Products",
				operationId: "list-products",
				parameters: [
					{
						in: "query",
						schema: {
							$ref: "#/components/schemas/NumSchema",
							default: 10,
						},

						name: "num",
					},
				],
				response: {
					200: "ProductListSchema",
				},
			},
		},
	)
	.get("/sse", async function* () {
		const getProgress = progresser();

		let progress = 0;

		while (
			(progress = Math.min(
				100,
				await getProgress(100 + Math.floor(Math.random() * 100)),
			)) <= 100
		) {
			yield sse({
				event: "progress",
				data: {
					progress: progress,
					// message: "This is a message",
					// timestamp: new Date().toISOString(),
				},
			});
		}
	})

	.ws("/ws", {
		open(ws) {
			console.log("Client connected");

			// Send heartbeat every 30 seconds
			ws.store.interval = setInterval(() => {
				const payload = {
					kind: "products::new-products",
					timestamp: Date.now(),
					products: Array.from(genProducts(Math.ceil(Math.random() * 6))),
				};

				ws.send(JSON.stringify(payload));
			}, SEND_PRODUCT_INTERVAL);
		},

		message(ws, message) {
			console.log("Received from client:", message);
		},

		close(ws) {
			console.log("Client disconnected");

			// Important: cleanup interval
			clearInterval(ws.store.interval);
		},
	})

	.listen(4000, () => console.log("started"));

// Client
(function elysiaClient() {
	if (typeof EventSource === "undefined") {
		return;
	}
	const eventSource = new EventSource("http://localhost:4000/sse");

	eventSource.onmessage = (event) => {
		console.log("🚀 ~ event:", event);
		console.log("Received message:", event.data);
	};

	eventSource.addEventListener("message", (event) => {
		console.log("Custom event received:", event.data);
	});

	eventSource.onerror = (error) => {
		console.error("EventSource error:", error);
		eventSource.close();
	};
})();
