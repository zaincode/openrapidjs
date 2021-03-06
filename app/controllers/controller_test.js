// This is a controller file.
// Controller is a class that has methods to act as an endpoint
// Controller has access to parent methods such as get and validate requests, sending response back etc.
// It could also has multiple methods or endpoints

module.exports = class extends require("@core/controller"){

	// index() {
	// // If there is no method defined in route controller
	// // System will automatically look for index method inside the controller
	// 	console.log("This is an index controller")
	// }

	async login() {
		const ModelExample = await this.model("example");
		this.response.status(200).send({
			status : true,
			status_message : "OK",
			data : ModelExample
		});
	}
}