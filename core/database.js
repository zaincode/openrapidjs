// Database Helper module by Royan Zain 
// Used for easily connect and do some database stuff
// Created at october 28th 2019
// Version : v.1.0
// System Requires package : mysql2

const util = require('util'), 
	mysql = require('mysql'), helper = require("../libs/helper"),
	db_config = require("../config/env").database,
	colors = require('colors'),
	pool = mysql.createPool(db_config);

helper.print.log("Using database connection");

// Ping database to check for common exception errors.
pool.getConnection((err, connection) => {
  	if (err) {
	    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
	      helper.print.log('Database connection was closed.'.red)
	    }
	    if (err.code === 'ER_CON_COUNT_ERROR') {
	      helper.print.log('Database has too many connections.'.red)
	    }
	    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
	      helper.print.log('Access denied for database user and password.'.red)
	    }
	    if (err.code === 'ECONNREFUSED') {
	      helper.print.log('Database connection was refused.'.red)
	    }
  	}else{
		helper.print.log(`Database '${db_config.database}' Connected`.green);
  	}
  	console.log();
  	if (connection) connection.release()
  	return
});


// Promisify for Node.js async/await.
pool.query = util.promisify(pool.query);

var DatabaseHelper = { 
	EXPOSE_ALL : ["*"],
	queryString : '',
	tableFields : '',
	tableFieldValues : '',
	tableInsertedId : null,
	tableCondition : [],
	tableExposedFields : ["*"],
	tableExposedOrder : '',
	tableExposedLimit : '',
	tableExposedRaw : '',
	tableExposedPage : '',
	tableExposedJoin : '',
	tableDefaultLimit : 30,
	clearQuery : () => {
		DatabaseHelper.queryString = '';
		DatabaseHelper.tableFields = '';
		DatabaseHelper.tableFieldValues = '';
		DatabaseHelper.tableCondition = [],
		DatabaseHelper.tableExposedFields = ["*"];
		DatabaseHelper.tableExposedOrder = '';
		DatabaseHelper.tableExposedJoin = '';
		DatabaseHelper.tableExposedLimit = '';
		DatabaseHelper.tableExposedRaw = '';
		DatabaseHelper.tableExposedPage = '';
		DatabaseHelper.tableDefaultLimit = 30;
	},
	execute : async (query) => {
		try {
			const executeQuery = await pool.query(query);
			DatabaseHelper.clearQuery();
			return executeQuery;
		} catch(e) {
			helper.print.error(`[ERROR] ${"[".yellow + e.code.yellow}` + `] `.yellow + `${e.message.replace(e.code, "")} at '`.red + query + "'".red);
			return false;
		}
	},	
	setLimit : function(limit){
		DatabaseHelper.limit = limit;
	},
	$ : (sqlQuery) => {
		return {
			async execute() {
				try {
					return await pool.query(sqlQuery);
				} catch(e) {
					helper.print.error(`[ERROR] ${"[".yellow + e.code.yellow}` + `] `.yellow + `${e.message.replace(e.code, "")} at '`.red + sqlQuery + "'".red);
					return false;
				}
			}
		}
	},
	table : (tableName) => {
		// Available database manipulation methods methods
		return {
			// Insert data into database
			insert : async (values) => {
				var tableFields = "";
				var tableFieldValues = "";
				// Loop each object and get the key
				Object.keys(values).forEach(key => {
					// Add key into tableFields variable
					tableFields += key + ", ";
					if(key == 'id' && key != '' && key != undefined){
						tableFieldValues += mysql.escape(values[key]) + ", ";
					}else{
						tableFieldValues +=  mysql.escape(values[key]) + ", ";
					}
				});
				// Extract table columns
				tableFields = tableFields.substr(0, tableFields.length - 2);
				// Extract table field values
				tableFieldValues = tableFieldValues.substr(0, tableFieldValues.length - 2);
				// Build the query string
				DatabaseHelper.queryString = `INSERT INTO ${tableName} (${tableFields}) VALUES (${tableFieldValues})`;
				const executeQuery = await DatabaseHelper.execute(DatabaseHelper.queryString);
				// If data successfully inserted
				if (executeQuery.affectedRows > 0) {
					// Store insertedId into a global object
					DatabaseHelper.tableInsertedId = executeQuery.insertId;
					// Returns true as a succesfull query
					return true;
				}else{
					helper.print.log(executeQuery.message.red)
					// Return false if failed inserting data
					return false;
				}
			},
			// Expose data from the table
			expose : async (args = {}) => {
				DatabaseHelper.tableExposedFields = args !== undefined && args.fields !== undefined  ? args.fields : ["*"];
				if (args !== undefined && args.where !== undefined) {
					if(Object.keys(args.where).length > 0){
						Object.keys(args.where).forEach(condition => {
							DatabaseHelper.tableCondition.push(`${condition} = '${args.where[condition]}' `);
						});
					}
				}

				if (typeof args !== undefined) {
					if (args.page  !== undefined) {
						var limit = args.limit !== undefined ? args.limit : DatabaseHelper.tableDefaultLimit;
						var offset = (args.page - 1) * limit;
						DatabaseHelper.tableExposedPage = ` LIMIT ${limit} OFFSET ${offset} `;
					}
				}

				if (typeof args !== undefined) {
					if (args.join !== undefined) {
						args.join.map(join => {
							DatabaseHelper.tableExposedJoin = ` INNER JOIN ${join.table} ON ${join.on} `;
						});
					}
				}

				// Build the query string
				DatabaseHelper.queryString = `SELECT 
					${DatabaseHelper.tableExposedFields.join(", ")} 
					FROM 
					${tableName} 
					${DatabaseHelper.tableExposedJoin}
					${DatabaseHelper.tableCondition.length > 0 ? "WHERE" : ""} 
					${DatabaseHelper.tableCondition.join(' AND ')} 
					${args !== undefined && args.orderBy !== undefined ? " ORDER BY " + args.orderBy[0] + "  " + args.orderBy[1] : ""} 
					${DatabaseHelper.tableExposedPage}
					${args !== undefined && args.limit !== undefined && DatabaseHelper.tableExposedPage == '' ? " LIMIT " + args.limit : ""} 
					${args !== undefined && args.offset !== undefined ? " OFFSET " + args.offset : ""} 
					${args !== undefined && args.extra !== undefined ? args.extra : ""}
				`;
				const executeQuery = await DatabaseHelper.execute(DatabaseHelper.queryString);
				return executeQuery;
			},
			// Find if a piece of data exist in the table
			is : (where = {}) => {
				return {
					exist : async () => {
						if(Object.keys(where).length > 0){
							Object.keys(where).forEach(condition => {
								DatabaseHelper.tableCondition.push(`${condition} = '${where[condition]}' `);
							});
						}
						const executeQuery = await DatabaseHelper.execute(`
							SELECT 
								COUNT(*) as result
							FROM 
								${tableName} 
								${DatabaseHelper.tableCondition.length > 0 ? "WHERE" : ""} 
								${DatabaseHelper.tableCondition.join(' AND ')} 
						`);
						if (executeQuery[0].result > 0) {
							return true;
						}else{
							return false;
						}
					}
				}
			},
			// Delete row from table
			delete : async (where = {}) => {
				if(Object.keys(where).length > 0){
					Object.keys(where).forEach(condition => {
						DatabaseHelper.tableCondition.push(`${condition} = '${where[condition]}' `);
					});
				}
				const executeQuery = await DatabaseHelper.execute(`
					DELETE FROM 
						${tableName} 
						${DatabaseHelper.tableCondition.length > 0 ? "WHERE" : ""} 
						${DatabaseHelper.tableCondition.join(' AND ')} 
				`);
				if (executeQuery.affectedRows > 0) {
					// Returns true as a succesfull query
					return true;
				}else{
					helper.print.log(executeQuery.message.red)
					// Return false if failed inserting data
					return false;
				}
			},
			// Updates table with certain conditions
			update : async (dataSets = {}, where = {}) => {
				var updatedDataSets = [];
				if(Object.keys(dataSets).length > 0){
					Object.keys(dataSets).forEach(data => {
						updatedDataSets.push(`${data} = ${mysql.escape(dataSets[data])}`);
					});
				}
				if(Object.keys(where).length > 0){
					Object.keys(where).forEach((condition, index) => {
						DatabaseHelper.tableCondition.push(`${condition} = '${where[condition]}'`);
					});
				}
				const executeQuery = await DatabaseHelper.execute(`
					UPDATE  
						${tableName} 
					SET
						${updatedDataSets.join(", ")} 
						${DatabaseHelper.tableCondition.length > 0 ? "WHERE" : ""} 
						${DatabaseHelper.tableCondition.join(' AND ')} 
				`);
				if (executeQuery.affectedRows > 0) {
					// Returns true as a succesfull query
					return true;
				}else{
					helper.print.log(executeQuery.message.red)
					// Return false if failed inserting data
					return false;
				}
			}
		}
	}
}

const sqlProcedures = async () => {
	const databaseProcedure = await DatabaseHelper.execute(`
		SHOW PROCEDURE STATUS WHERE Db = '${db_config.database}'
	`);
	var returnedProcedures = {};
	databaseProcedure.forEach(procedure => {
		Object.assign(returnedProcedures, {[procedure.Name] : async (params) => {
			return await DatabaseHelper.execute(`CALL ${procedure.Name}(${params})`);
		} })
	})
	return returnedProcedures;
}

module.exports = async () => {
	let connection = await pool;
	// Assign wether database is connected or not
	// Assign database procedures as a javascript function
	db_config.use_procedure !== undefined && db_config.use_procedure == true ? 
	await Object.assign(pool, {
		$call : await sqlProcedures()
	}) : false;
	// Assign Database helper
	await Object.assign(pool, DatabaseHelper);
	// Returns connection
 	return connection;
}