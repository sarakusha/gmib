cmake_minimum_required(VERSION 3.10)
project(node_gst_player)
set(CMAKE_CXX_STANDARD 17)

#list(APPEND CMAKE_MODULE_PATH ${CMAKE_SOURCE_DIR}/cmake)
#message ("--   CMAKE_MODULE_PATH \"${CMAKE_MODULE_PATH}\"")


# The version number.
set(node_gst_player_VERSION_MAJOR 1)
set(node_gst_player_VERSION_MINOR 0)
set(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -DDEBUG")

add_definitions(-DG_LOG_USE_STRUCTURED)
if (${CMAKE_SYSTEM_NAME} MATCHES "Darwin")
    add_definitions(-DMACOSX)
    set_source_files_properties(src/player.cc PROPERTIES COMPILE_FLAGS -xobjective-c++)
endif ()

add_definitions(-DNAPI_VERSION=3 -DNAPI_EXPERIMENTAL)

function(PARSE_CMAKEJS_PROPERTIES)
    function(GET_VARIABLE INPUT_STRING VARIABLE_TO_SELECT OUTPUT_VARIABLE)
        set(SEARCH_STRING "${VARIABLE_TO_SELECT}=\"")
        string(LENGTH "${SEARCH_STRING}" SEARCH_STRING_LENGTH)
        string(LENGTH "${INPUT_STRING}" INPUT_STRING_LENGTH)

        string(FIND "${INPUT_STRING}" "${VARIABLE_TO_SELECT}=\"" SEARCH_STRING_INDEX)

        if (SEARCH_STRING_INDEX GREATER -1)
            math(EXPR SEARCH_STRING_INDEX "${SEARCH_STRING_INDEX}+${SEARCH_STRING_LENGTH}")

            string(SUBSTRING "${INPUT_STRING}" ${SEARCH_STRING_INDEX} ${INPUT_STRING_LENGTH} AFTER_SEARCH_STRING)
            string(FIND "${AFTER_SEARCH_STRING}" "\"" QUOTE_INDEX)
            string(SUBSTRING "${AFTER_SEARCH_STRING}" "0" "${QUOTE_INDEX}" RESULT_STRING)
            set("${OUTPUT_VARIABLE}" "${RESULT_STRING}" PARENT_SCOPE)
        endif ()
    endfunction(GET_VARIABLE)

    string(TOLOWER "${CMAKE_BUILD_TYPE}" CMAKE_BUILD_TYPE_LOWER)
    if (CMAKE_BUILD_TYPE_LOWER STREQUAL "debug")
        execute_process(COMMAND ./node_modules/.bin/cmake-js print-configure --debug
                WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
                OUTPUT_VARIABLE CMAKE_JS_OUTPUT
                )
    else ()
        execute_process(COMMAND ./node_modules/.bin/cmake-js print-configure
                WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
                OUTPUT_VARIABLE CMAKE_JS_OUTPUT
                )
    endif ()

    get_variable("${CMAKE_JS_OUTPUT}" "CMAKE_JS_INC" CMAKE_JS_INC)
    set(CMAKE_JS_INC "${CMAKE_JS_INC}" PARENT_SCOPE)

    get_variable("${CMAKE_JS_OUTPUT}" "CMAKE_LIBRARY_OUTPUT_DIRECTORY" CMAKE_LIBRARY_OUTPUT_DIRECTORY)
    set(CMAKE_LIBRARY_OUTPUT_DIRECTORY "${CMAKE_LIBRARY_OUTPUT_DIRECTORY}" PARENT_SCOPE)

    get_variable("${CMAKE_JS_OUTPUT}" "CMAKE_JS_VERSION" CMAKE_JS_VERSION)
    set(CMAKE_JS_VERSION "${CMAKE_JS_VERSION}" PARENT_SCOPE)

    get_variable("${CMAKE_JS_OUTPUT}" "CMAKE_JS_LIB" CMAKE_JS_LIB)
    set(CMAKE_JS_LIB "${CMAKE_JS_LIB}" PARENT_SCOPE)

endfunction(PARSE_CMAKEJS_PROPERTIES)

if (NOT CMAKE_JS_INC)
    parse_cmakejs_properties()
endif ()

# Essential include files to build a node addon,
# You should add this line in every CMake.js based project
include_directories(${CMAKE_JS_INC})

# libX11-dev
find_package(X11 REQUIRED)
include_directories(${X11_INCLUDE_DIR} ${X11_Xrandr_INCLUDE_PATH})

# Use the package PkgConfig to detect GTK+ headers/library files
find_package(PkgConfig REQUIRED)

# Setup CMake to use GTK+, tell the compiler where to look for headers
# and to the linker where to look for libraries
# libgtk-3-dev
pkg_check_modules(GTK3 REQUIRED gtk+-3.0)
include_directories(${GTK3_INCLUDE_DIRS})
link_directories(${GTK3_LIBRARY_DIRS})
add_definitions(${GTK3_CFLAGS_OTHER})

pkg_check_modules(GST REQUIRED gstreamer-1.0 gstreamer-base-1.0 gstreamer-video-1.0 gstreamer-plugins-base-1.0 gstreamer-plugins-bad-1.0 gstreamer-player-1.0)
include_directories(${GST_INCLUDE_DIRS})
link_directories(${GST_LIBRARY_DIRS})
add_definitions(${GST_CFLAGS_OTHER})
message("GSTREAMER LIBS " ${GST_LIBRARIES})
message("GSTREAMER" ${GST_INCLUDE_DIRS})

pkg_check_modules(GSTMM REQUIRED gstreamermm-1.0)
include_directories(${GSTMM_INCLUDE_DIRS})
link_directories(${GSTMM_LIBRARY_DIRS})
add_definitions(${GSTMM_CFLAGS_OTHER})

pkg_check_modules(GTKMM REQUIRED gtkmm-3.0)
include_directories(${GTKMM_INCLUDE_DIRS})
link_directories(${GTKMM_LIBRARY_DIRS})
add_definitions(${GTKMM_CFLAGS_OTHER})
# Build a shared library named after the project from the files in `src/`
file(GLOB SOURCE_FILES "src/*.cc" "src/*.h")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES})

# Gives our library file a .node extension without any "lib" prefix
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

# Include N-API wrappers
target_include_directories(${PROJECT_NAME} PRIVATE "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api")

# Essential library files to link to a node addon
# You should add this line in every CMake.js based project
target_link_libraries(${PROJECT_NAME}
        ${CMAKE_JS_LIB}
        ${X11_LIBRARIES}
        ${X11_Xrandr_LIB}
        ${GST_LIBRARIES}
        ${GTK3_LIBRARIES}
        ${GSTMM_LIBRARIES}
        ${GTKMM_LIBRARIES})

# if libintl not found
# brew unlink gettext && brew link --force gettext


